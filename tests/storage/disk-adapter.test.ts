import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { createDiskAdapter, resolveSafePath } from "../../src/storage/adapters/disk";
import { rm, mkdir } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { createHash } from "node:crypto";

const TEST_DIR = resolve("./test-tmp-disk-adapter");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("resolveSafePath", () => {
  it("resolves a simple filename within the base", () => {
    const result = resolveSafePath("/base", "file.txt");
    expect(result).toBe(resolve("/base/file.txt"));
  });

  it("resolves nested paths within the base", () => {
    const result = resolveSafePath("/base", "a/b/c.txt");
    expect(result).toBe(resolve("/base/a/b/c.txt"));
  });

  it("rejects path traversal with ../", () => {
    expect(() => resolveSafePath("/base", "../etc/passwd")).toThrow(
      "Path traversal detected",
    );
  });

  it("rejects path traversal with absolute paths", () => {
    // resolve("/base", "/etc/passwd") => "/etc/passwd" which escapes
    expect(() => resolveSafePath("/base", "/etc/passwd")).toThrow(
      "Path traversal detected",
    );
  });

  it("handles double dots in the middle of a path", () => {
    expect(() => resolveSafePath("/base", "a/../../etc/passwd")).toThrow(
      "Path traversal detected",
    );
  });

  it("property: resolved path always starts with base path or throws traversal error", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (filename) => {
          const base = "/safe/base";
          try {
            const result = resolveSafePath(base, filename);
            expect(result.startsWith(resolve(base))).toBe(true);
          } catch (error) {
            // Path traversal rejection is acceptable — it means the guard works
            if (error instanceof Error) {
              expect(error.message).toContain("Path traversal detected");
            }
          }
        },
      ),
    );
  });

  it("property: any path with ../ prefix is rejected or stays within base", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 20 }), (suffix) => {
        const base = "/safe/base";
        const malicious = `../${suffix}`;
        try {
          const result = resolveSafePath(base, malicious);
          // If it didn't throw, it must still be within base
          expect(result.startsWith(resolve(base))).toBe(true);
        } catch (error) {
          if (error instanceof Error) {
            expect(error.message).toContain("Path traversal detected");
          }
        }
      }),
    );
  });

  it("rejects a path whose resolved form is a sibling directory sharing a name prefix", () => {
    // Guards against the prefix false-positive: "/base-other/file" starts with "/base"
    // as a string but should NOT be accepted when base is "/base".
    // The sep-appended check ("/base" + sep) prevents this.
    const base = "/safe/base";
    expect(() => resolveSafePath(base, "/safe/base-other/file.txt")).toThrow(
      "Path traversal detected",
    );
  });

  it("accepts a destination that resolves exactly to the base directory", () => {
    // Covers the `full === resolvedBase` branch — destination "." collapses to base.
    const base = "/safe/base";
    const result = resolveSafePath(base, ".");
    expect(result).toBe(resolve(base));
  });

  it("resolved result always begins with base + sep or equals base exactly", () => {
    // Locks in the platform-native separator requirement introduced by the fix.
    // If sep were replaced with a hardcoded "/" this would fail on Windows.
    const base = "/safe/base";
    const resolvedBase = resolve(base);

    const validCases = ["file.txt", "a/b.txt", "deeply/nested/file.bin", "."];
    for (const dest of validCases) {
      const result = resolveSafePath(base, dest);
      const withinBase =
        result === resolvedBase || result.startsWith(resolvedBase + sep);
      expect(withinBase).toBe(true);
    }
  });
});

describe("createDiskAdapter", () => {
  it("put then download round-trips data correctly", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

    const result = await adapter.put(data, "test-file.bin", "application/octet-stream");

    expect(result.uri).toBe("test-file.bin");
    expect(result.hash[0]).toBe("md5");
    expect(result.hash[1]).toBe(
      createHash("md5").update(data).digest("hex"),
    );

    const downloaded = await adapter.downloadAsBytes("test-file.bin");
    expect(downloaded).toEqual(data);
  });

  it("creates nested directories for the destination", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    const data = new Uint8Array([1, 2, 3]);

    await adapter.put(data, "a/b/c/deep-file.bin");

    const downloaded = await adapter.downloadAsBytes("a/b/c/deep-file.bin");
    expect(downloaded).toEqual(data);
  });

  it("has the correct name and version", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    expect(adapter.name).toBe("disk");
    expect(adapter.version).toMatch(/^disk\.\d{6}\.\d{2}$/);
  });

  it("throws when downloading a non-existent file", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    await expect(adapter.downloadAsBytes("nonexistent.bin")).rejects.toThrow();
  });

  it("property: put/download round-trip preserves arbitrary byte data", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);

    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 1024 }),
        fc.uuid(),
        async (data, id) => {
          const destination = `prop-test/${id}`;
          const result = await adapter.put(data, destination);

          expect(result.uri).toBe(destination);
          expect(result.hash[0]).toBe("md5");

          const expectedHash = createHash("md5").update(data).digest("hex");
          expect(result.hash[1]).toBe(expectedHash);

          const downloaded = await adapter.downloadAsBytes(destination);
          expect(downloaded).toEqual(data);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("rejects path traversal in put", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    const data = new Uint8Array([1]);

    await expect(
      adapter.put(data, "../escape.bin"),
    ).rejects.toThrow("Path traversal detected");
  });

  it("rejects path traversal in downloadAsBytes", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);

    await expect(
      adapter.downloadAsBytes("../../etc/passwd"),
    ).rejects.toThrow("Path traversal detected");
  });

  it("delete removes a previously stored file", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    const data = new Uint8Array([1, 2, 3]);

    await adapter.put(data, "to-delete.bin");
    // Confirm it exists
    const downloaded = await adapter.downloadAsBytes("to-delete.bin");
    expect(downloaded).toEqual(data);

    await adapter.delete("to-delete.bin");

    // Download should now fail
    await expect(adapter.downloadAsBytes("to-delete.bin")).rejects.toThrow();
  });

  it("delete is idempotent for missing files", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    // Should not throw even if file doesn't exist
    await expect(adapter.delete("nonexistent.bin")).resolves.toBeUndefined();
  });

  it("rejects path traversal in delete", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    await expect(adapter.delete("../escape.bin")).rejects.toThrow(
      "Path traversal detected",
    );
  });

  it("rejects uploads exceeding the size limit", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    const oversized = new Uint8Array(50 * 1024 * 1024 + 1);
    await expect(
      adapter.put(oversized, "too-large.bin", "application/octet-stream"),
    ).rejects.toThrow("Upload exceeds size limit");
  });

  it("rejects disallowed mimetypes", async () => {
    const adapter = await createDiskAdapter(TEST_DIR);
    const data = new Uint8Array([1]);
    await expect(
      adapter.put(data, "bad.exe", "application/x-executable"),
    ).rejects.toThrow("Mimetype not allowed");
  });

  it("put then download round-trips data for a flat (non-nested) filename", async () => {
    // Confirms dirname() on a flat path doesn't break single-level put.
    // Regression guard: the old lastIndexOf("/") + substring approach could
    // return an empty string on Windows for flat filenames; dirname() is safe.
    const adapter = await createDiskAdapter(TEST_DIR);
    const data = new Uint8Array([10, 20, 30]);

    const result = await adapter.put(data, "flat-file.bin");

    expect(result.uri).toBe("flat-file.bin");
    const downloaded = await adapter.downloadAsBytes("flat-file.bin");
    expect(downloaded).toEqual(data);
  });

  it("delete removes a nested file without error", async () => {
    // Covers resolveSafePath in the delete code path for nested URIs.
    const adapter = await createDiskAdapter(TEST_DIR);
    const data = new Uint8Array([7, 8, 9]);

    await adapter.put(data, "nested/dir/file.bin");
    await adapter.delete("nested/dir/file.bin");

    await expect(adapter.downloadAsBytes("nested/dir/file.bin")).rejects.toThrow();
  });
});
