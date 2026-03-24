import type { StorageAdapter, AdapterConfigDefinition } from "./base.ts";
import { validatePut } from "./base.ts";
import type { ConfigField, PutOutput } from "../types.ts";
import { ResourceOperationError } from "../errors.ts";

export type GCPAdapterConfig = {
  serviceAccount: Record<string, unknown>;
  bucketName: string;
};

export const gcpConfigFields: readonly ConfigField[] = [
  { key: "gcp_service_account", required: true, secret: true, valueType: "json" },
  {
    key: "gcp_bucket_name",
    required: false,
    secret: false,
    valueType: "string",
    default: "hikmahealthdata.appspot.com",
  },
] as const;

export const gcpConfigDefinition: AdapterConfigDefinition = { fields: gcpConfigFields };

export const createGCPAdapter = async (
  config: GCPAdapterConfig,
): Promise<StorageAdapter> => {
  const { Storage } = await import("@google-cloud/storage");

  const storage = new Storage({
    credentials: config.serviceAccount,
  });

  const bucket = storage.bucket(config.bucketName);

  // Auto-create bucket if it doesn't exist
  const [exists] = await bucket.exists();
  if (!exists) {
    await bucket.create();
  }

  return {
    name: "gcp",
    version: "gcp.202603.01",

    async put(data: Uint8Array, destination: string, mimetype?: string): Promise<PutOutput> {
      validatePut(data, mimetype);
      try {
        const file = bucket.file(destination);
        await file.save(Buffer.from(data), {
          contentType: mimetype ?? "application/octet-stream",
          validation: "md5",
        });
        // Reload metadata to get the md5Hash
        const [metadata] = await file.getMetadata();
        const md5 = metadata.md5Hash
          ? Buffer.from(metadata.md5Hash, "base64").toString("hex")
          : "";
        return { uri: destination, hash: ["md5", md5] as const };
      } catch (error) {
        throw new ResourceOperationError("put", error);
      }
    },

    async delete(uri: string): Promise<void> {
      try {
        await bucket.file(uri).delete({ ignoreNotFound: true });
      } catch (error) {
        throw new ResourceOperationError("delete", error);
      }
    },

    async downloadAsBytes(uri: string): Promise<Uint8Array> {
      try {
        const [contents] = await bucket.file(uri).download();
        return new Uint8Array(contents);
      } catch (error) {
        throw new ResourceOperationError("downloadAsBytes", error);
      }
    },
  };
};
