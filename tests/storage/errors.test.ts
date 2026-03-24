import { describe, it, expect } from "vitest";
import {
  ResourceManagerInitError,
  ResourceNotFoundError,
  ResourceStoreTypeMismatchError,
  ResourceOperationError,
} from "../../src/storage/errors";

describe("storage errors", () => {
  it("ResourceManagerInitError has correct name and message", () => {
    const err = new ResourceManagerInitError("bad config");
    expect(err.name).toBe("ResourceManagerInitError");
    expect(err.message).toBe("bad config");
    expect(err).toBeInstanceOf(Error);
  });

  it("ResourceNotFoundError includes the resource ID", () => {
    const err = new ResourceNotFoundError("abc-123");
    expect(err.name).toBe("ResourceNotFoundError");
    expect(err.message).toContain("abc-123");
  });

  it("ResourceStoreTypeMismatchError includes both store types", () => {
    const err = new ResourceStoreTypeMismatchError("s3", "gcp");
    expect(err.message).toContain("s3");
    expect(err.message).toContain("gcp");
  });

  it("ResourceOperationError wraps a cause", () => {
    const cause = new Error("network timeout");
    const err = new ResourceOperationError("put", cause);
    expect(err.message).toContain("put");
    expect(err.message).toContain("network timeout");
    expect(err.cause).toBe(cause);
  });

  it("ResourceOperationError works without a cause", () => {
    const err = new ResourceOperationError("downloadAsBytes");
    expect(err.message).toContain("downloadAsBytes");
  });
});
