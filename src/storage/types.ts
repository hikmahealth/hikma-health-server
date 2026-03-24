export const SUPPORTED_STORES = [
  "s3",
  "tigris",
  "gcp",
  "azure",
  "disk",
] as const;
export type StoreType = (typeof SUPPORTED_STORES)[number];

export const isStoreType = (value: string): value is StoreType =>
  (SUPPORTED_STORES as readonly string[]).includes(value);

/** Returned by every adapter after a successful upload */
export type PutOutput = {
  readonly uri: string;
  readonly hash: readonly [algorithm: string, digest: string];
};

/** Describes a single configuration field for a storage adapter */
export type ConfigField = {
  readonly key: string;
  readonly required: boolean;
  /** If true, mask this field's value in API responses */
  readonly secret: boolean;
  readonly valueType: "string" | "json";
  readonly default?: string;
};

/** Max upload size in bytes (50 MB) */
export const UPLOAD_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

/** Mimetypes accepted for resource uploads */
export const ALLOWED_MIMETYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "text/plain",
  "text/csv",
  // Audio/video (clinical recordings)
  "audio/mpeg",
  "audio/ogg",
  "video/mp4",
  // Generic binary (e.g. DICOM, HL7 exports)
  "application/octet-stream",
]);

export const isAllowedMimetype = (mimetype: string): boolean =>
  ALLOWED_MIMETYPES.has(mimetype);

/** Default path prefix for form resource uploads */
export const RESOURCE_PATH_PREFIX = "hh_forms_resources";

/** Default path prefix for education content resource uploads */
export const EDUCATION_RESOURCE_PATH_PREFIX = "hh_education_resources";
