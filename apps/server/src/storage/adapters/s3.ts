import type { StorageAdapter, AdapterConfigDefinition } from "./base.ts";
import { validatePut } from "./base.ts";
import type { ConfigField, PutOutput, StoreType } from "../types.ts";
import { ResourceOperationError } from "../errors.ts";

export type S3AdapterConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  /** When set, uses a custom S3-compatible endpoint (e.g. Tigris) */
  endpoint?: string;
};

// Tigris requires an explicit bucket name and endpoint
const s3BaseFields: readonly ConfigField[] = [
  { key: "aws_access_key_id", required: true, secret: true, valueType: "string" },
  { key: "aws_secret_access_key", required: true, secret: true, valueType: "string" },
  { key: "aws_region", required: false, secret: false, valueType: "string", default: "us-east-1" },
  { key: "s3_bucket_name", required: false, secret: false, valueType: "string", default: "hikmahealth-s3" },
] as const;

const tigrisExtraFields: readonly ConfigField[] = [
  { key: "aws_endpoint_url_s3", required: true, secret: false, valueType: "string" },
] as const;

export const s3ConfigFields: readonly ConfigField[] = s3BaseFields;

export const tigrisConfigFields: readonly ConfigField[] = [
  ...s3BaseFields.map((f) =>
    // Tigris requires bucket name — override the default
    f.key === "s3_bucket_name" ? { ...f, required: true, default: undefined } : f,
  ),
  ...tigrisExtraFields,
];

export const s3ConfigDefinition: AdapterConfigDefinition = { fields: s3ConfigFields };
export const tigrisConfigDefinition: AdapterConfigDefinition = { fields: tigrisConfigFields };

/**
 * Create an S3 adapter. When `config.endpoint` is set, it operates in
 * S3-compatible mode (Tigris). The adapter name reflects which variant is active
 * so that the resources table records the correct store type.
 */
export const createS3Adapter = async (
  config: S3AdapterConfig,
): Promise<StorageAdapter> => {
  // Dynamic import — only loads SDK when this adapter is actually used
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } =
    await import("@aws-sdk/client-s3");

  const isTigris = config.endpoint !== undefined;
  const storeName: StoreType = isTigris ? "tigris" : "s3";

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    ...(config.endpoint
      ? { endpoint: config.endpoint, forcePathStyle: false }
      : {}),
  });

  // Auto-create bucket if it doesn't exist.
  // Only catch NotFound (404) — let auth errors (403) propagate immediately.
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucketName }));
  } catch (error: unknown) {
    const statusCode =
      error != null && typeof error === "object" && "$metadata" in error
        ? (error as { $metadata: { httpStatusCode?: number } }).$metadata.httpStatusCode
        : undefined;
    if (statusCode === 404) {
      await client.send(new CreateBucketCommand({ Bucket: config.bucketName }));
    } else {
      throw error;
    }
  }

  return {
    name: storeName,
    version: `s3.${isTigris ? "tigris" : "native"}.202603.01`,

    async put(data: Uint8Array, destination: string, mimetype?: string): Promise<PutOutput> {
      validatePut(data, mimetype);
      try {
        const response = await client.send(
          new PutObjectCommand({
            Bucket: config.bucketName,
            Key: destination,
            Body: data,
            ContentType: mimetype ?? "application/octet-stream",
            ACL: "private",
          }),
        );
        // ETag is typically the MD5 of the object, quoted
        const etag = (response.ETag ?? "").replace(/"/g, "");
        return { uri: destination, hash: ["md5", etag] as const };
      } catch (error) {
        throw new ResourceOperationError("put", error);
      }
    },

    async delete(uri: string): Promise<void> {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.bucketName,
            Key: uri,
          }),
        );
      } catch (error) {
        throw new ResourceOperationError("delete", error);
      }
    },

    async downloadAsBytes(uri: string): Promise<Uint8Array> {
      try {
        const response = await client.send(
          new GetObjectCommand({
            Bucket: config.bucketName,
            Key: uri,
            ChecksumMode: "ENABLED",
          }),
        );
        // Response body is a readable stream — collect into Uint8Array
        const stream = response.Body;
        if (!stream) throw new Error("Empty response body from S3");
        return new Uint8Array(await stream.transformToByteArray());
      } catch (error) {
        throw new ResourceOperationError("downloadAsBytes", error);
      }
    },
  };
};
