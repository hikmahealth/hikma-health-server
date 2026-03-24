import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { SUPPORTED_STORES, isStoreType, ALLOWED_MIMETYPES, isAllowedMimetype } from "../../src/storage/types";

describe("SUPPORTED_STORES", () => {
  it("contains exactly the five expected providers", () => {
    expect(SUPPORTED_STORES).toEqual(["s3", "tigris", "gcp", "azure", "disk"]);
  });
});

describe("isStoreType", () => {
  it("returns true for each supported store", () => {
    for (const store of SUPPORTED_STORES) {
      expect(isStoreType(store)).toBe(true);
    }
  });

  it("returns false for unknown strings", () => {
    expect(isStoreType("dropbox")).toBe(false);
    expect(isStoreType("")).toBe(false);
    expect(isStoreType("S3")).toBe(false); // case-sensitive
  });

  it("property: only supported values return true", () => {
    const supportedSet = new Set<string>(SUPPORTED_STORES);
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(isStoreType(value)).toBe(supportedSet.has(value));
      }),
    );
  });
});

describe("isAllowedMimetype", () => {
  it("accepts each allowed mimetype", () => {
    for (const mime of ALLOWED_MIMETYPES) {
      expect(isAllowedMimetype(mime)).toBe(true);
    }
  });

  it("rejects unknown mimetypes", () => {
    expect(isAllowedMimetype("application/x-executable")).toBe(false);
    expect(isAllowedMimetype("text/html")).toBe(false);
    expect(isAllowedMimetype("application/javascript")).toBe(false);
    expect(isAllowedMimetype("")).toBe(false);
  });

  it("property: only allowlisted values return true", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(isAllowedMimetype(value)).toBe(ALLOWED_MIMETYPES.has(value));
      }),
    );
  });
});
