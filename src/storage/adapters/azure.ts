import type { StorageAdapter, AdapterConfigDefinition } from "./base.ts";
import { validatePut } from "./base.ts";
import type { ConfigField, PutOutput } from "../types.ts";
import { ResourceOperationError } from "../errors.ts";

export type AzureAdapterConfig = {
  connectionString: string;
  containerName: string;
};

export const azureConfigFields: readonly ConfigField[] = [
  { key: "azure_storage_connection_string", required: true, secret: true, valueType: "string" },
  {
    key: "azure_container_name",
    required: false,
    secret: false,
    valueType: "string",
    default: "hikmahealth",
  },
] as const;

export const azureConfigDefinition: AdapterConfigDefinition = { fields: azureConfigFields };

export const createAzureAdapter = async (
  config: AzureAdapterConfig,
): Promise<StorageAdapter> => {
  const { BlobServiceClient } = await import("@azure/storage-blob");

  const serviceClient = BlobServiceClient.fromConnectionString(config.connectionString);
  const containerClient = serviceClient.getContainerClient(config.containerName);

  await containerClient.createIfNotExists();

  return {
    name: "azure",
    version: "azure.202603.01",

    async put(data: Uint8Array, destination: string, mimetype?: string): Promise<PutOutput> {
      validatePut(data, mimetype);
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(destination);
        const response = await blockBlobClient.upload(data, data.length, {
          blobHTTPHeaders: {
            blobContentType: mimetype ?? "application/octet-stream",
          },
        });
        const md5 = response.contentMD5
          ? Buffer.from(response.contentMD5).toString("hex")
          : "";
        return { uri: destination, hash: ["md5", md5] as const };
      } catch (error) {
        throw new ResourceOperationError("put", error);
      }
    },

    async delete(uri: string): Promise<void> {
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(uri);
        await blockBlobClient.deleteIfExists();
      } catch (error) {
        throw new ResourceOperationError("delete", error);
      }
    },

    async downloadAsBytes(uri: string): Promise<Uint8Array> {
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(uri);
        const buffer = await blockBlobClient.downloadToBuffer();
        return new Uint8Array(buffer);
      } catch (error) {
        throw new ResourceOperationError("downloadAsBytes", error);
      }
    },
  };
};
