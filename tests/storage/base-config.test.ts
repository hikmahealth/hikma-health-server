import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { loadConfigFromServerVariables, maskSecrets, validatePut } from "../../src/storage/adapters/base";
import type { ConfigField } from "../../src/storage/types";
import { UPLOAD_SIZE_LIMIT_BYTES, ALLOWED_MIMETYPES } from "../../src/storage/types";

describe("loadConfigFromServerVariables", () => {
  const makeGetters = (data: Record<string, string | null>) => {
    const getAsString = vi.fn(async (key: string) => data[key] ?? null);
    const getAsJson = vi.fn(async (key: string) => {
      const raw = data[key];
      return raw ? JSON.parse(raw) : null;
    });
    return { getAsString, getAsJson };
  };

  it("loads present values from getAsString", async () => {
    const fields: ConfigField[] = [
      { key: "region", required: true, secret: false, valueType: "string" },
    ];
    const { getAsString, getAsJson } = makeGetters({ region: "us-west-2" });

    const config = await loadConfigFromServerVariables(fields, getAsString, getAsJson);
    expect(config).toEqual({ region: "us-west-2" });
  });

  it("loads JSON values from getAsJson", async () => {
    const fields: ConfigField[] = [
      { key: "creds", required: true, secret: true, valueType: "json" },
    ];
    const obj = { type: "service_account", project_id: "test" };
    const { getAsString, getAsJson } = makeGetters({
      creds: JSON.stringify(obj),
    });

    const config = await loadConfigFromServerVariables(fields, getAsString, getAsJson);
    expect(config).toEqual({ creds: obj });
  });

  it("uses default when value is missing", async () => {
    const fields: ConfigField[] = [
      { key: "region", required: false, secret: false, valueType: "string", default: "us-east-1" },
    ];
    const { getAsString, getAsJson } = makeGetters({});

    const config = await loadConfigFromServerVariables(fields, getAsString, getAsJson);
    expect(config).toEqual({ region: "us-east-1" });
  });

  it("throws when a required field is missing", async () => {
    const fields: ConfigField[] = [
      { key: "secret_key", required: true, secret: true, valueType: "string" },
    ];
    const { getAsString, getAsJson } = makeGetters({});

    await expect(
      loadConfigFromServerVariables(fields, getAsString, getAsJson),
    ).rejects.toThrow("Missing required config field: secret_key");
  });

  it("omits optional missing fields without defaults", async () => {
    const fields: ConfigField[] = [
      { key: "optional_thing", required: false, secret: false, valueType: "string" },
    ];
    const { getAsString, getAsJson } = makeGetters({});

    const config = await loadConfigFromServerVariables(fields, getAsString, getAsJson);
    expect(config).toEqual({});
  });
});

describe("maskSecrets", () => {
  it("masks secret fields with ***", () => {
    const fields: ConfigField[] = [
      { key: "access_key", required: true, secret: true, valueType: "string" },
      { key: "region", required: false, secret: false, valueType: "string" },
    ];
    const config = { access_key: "AKIA...", region: "us-east-1" };

    const result = maskSecrets(fields, config);

    expect(result).toEqual([
      { key: "access_key", value: "***" },
      { key: "region", value: "us-east-1" },
    ]);
  });

  it("shows empty string for undefined non-secret values", () => {
    const fields: ConfigField[] = [
      { key: "bucket", required: false, secret: false, valueType: "string" },
    ];

    const result = maskSecrets(fields, {});
    expect(result).toEqual([{ key: "bucket", value: "" }]);
  });

  it("property: secret fields never expose their actual value", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (key, secretValue) => {
          const fields: ConfigField[] = [
            { key, required: true, secret: true, valueType: "string" },
          ];
          const config = { [key]: secretValue };

          const result = maskSecrets(fields, config);

          expect(result[0].value).toBe("***");
          expect(result[0].value).not.toBe(secretValue);
        },
      ),
    );
  });

  it("property: non-secret fields always show their actual value", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (key, value) => {
          const fields: ConfigField[] = [
            { key, required: true, secret: false, valueType: "string" },
          ];
          const config = { [key]: value };

          const result = maskSecrets(fields, config);

          expect(result[0].value).toBe(value);
        },
      ),
    );
  });
});

describe("validatePut", () => {
  it("accepts data within the size limit with an allowed mimetype", () => {
    const data = new Uint8Array(1024);
    expect(() => validatePut(data, "image/png")).not.toThrow();
  });

  it("accepts data with no mimetype (undefined)", () => {
    const data = new Uint8Array(100);
    expect(() => validatePut(data)).not.toThrow();
  });

  it("rejects data exceeding the size limit", () => {
    const data = new Uint8Array(UPLOAD_SIZE_LIMIT_BYTES + 1);
    expect(() => validatePut(data, "image/png")).toThrow("Upload exceeds size limit");
  });

  it("rejects a disallowed mimetype", () => {
    const data = new Uint8Array(10);
    expect(() => validatePut(data, "application/x-executable")).toThrow(
      "Mimetype not allowed",
    );
  });

  it("property: any data within limit with allowed mimetype passes", () => {
    const allowedList = [...ALLOWED_MIMETYPES];
    fc.assert(
      fc.property(
        fc.nat({ max: UPLOAD_SIZE_LIMIT_BYTES }),
        fc.integer({ min: 0, max: allowedList.length - 1 }),
        (size, mimeIdx) => {
          const data = new Uint8Array(size);
          const mime = allowedList[mimeIdx];
          expect(() => validatePut(data, mime)).not.toThrow();
        },
      ),
      { numRuns: 20 },
    );
  });

  it("property: any data over limit always throws", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: UPLOAD_SIZE_LIMIT_BYTES + 1, max: UPLOAD_SIZE_LIMIT_BYTES + 1000 }),
        (size) => {
          const data = new Uint8Array(size);
          expect(() => validatePut(data)).toThrow("Upload exceeds size limit");
        },
      ),
    );
  });
});
