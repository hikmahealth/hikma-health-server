import type { PutOutput, ConfigField } from "../types.ts";
import { UPLOAD_SIZE_LIMIT_BYTES, isAllowedMimetype } from "../types.ts";
import type ServerVariable from "@/models/server_variable.ts";

/** Every storage adapter implements this interface */
export type StorageAdapter = {
  readonly name: string;
  readonly version: string;
  put(data: Uint8Array, destination: string, mimetype?: string): Promise<PutOutput>;
  delete(uri: string): Promise<void>;
  downloadAsBytes(uri: string): Promise<Uint8Array>;
};

/**
 * Validate size and mimetype before writing to any adapter.
 * Call at the top of every adapter's `put` implementation.
 */
export const validatePut = (data: Uint8Array, mimetype?: string): void => {
  if (data.byteLength > UPLOAD_SIZE_LIMIT_BYTES) {
    throw new Error(
      `Upload exceeds size limit: ${data.byteLength} bytes > ${UPLOAD_SIZE_LIMIT_BYTES} bytes`,
    );
  }
  if (mimetype !== undefined && !isAllowedMimetype(mimetype)) {
    throw new Error(`Mimetype not allowed: ${mimetype}`);
  }
};

/** Static configuration definition for an adapter */
export type AdapterConfigDefinition = {
  readonly fields: readonly ConfigField[];
};

/**
 * Load config values from server_variables for the given field definitions.
 * Throws if a required field is missing.
 */
export const loadConfigFromServerVariables = async (
  fields: readonly ConfigField[],
  getAsString: typeof ServerVariable.getAsString,
  getAsJson: typeof ServerVariable.getAsJson,
): Promise<Record<string, unknown>> => {
  const config: Record<string, unknown> = {};

  for (const field of fields) {
    const value =
      field.valueType === "json"
        ? await getAsJson(field.key)
        : await getAsString(field.key);

    if (value !== null) {
      config[field.key] = value;
    } else if (field.default !== undefined) {
      config[field.key] = field.default;
    } else if (field.required) {
      throw new Error(`Missing required config field: ${field.key}`);
    }
  }

  return config;
};

/** Serialize config for API response, masking secret fields with '***' */
export const maskSecrets = (
  fields: readonly ConfigField[],
  config: Record<string, unknown>,
): Array<{ key: string; value: string }> =>
  fields.map((field) => ({
    key: field.key,
    value:
      field.secret && config[field.key] !== undefined
        ? "***"
        : String(config[field.key] ?? ""),
  }));
