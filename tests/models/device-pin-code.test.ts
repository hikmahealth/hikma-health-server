import { describe, it, expect } from "vitest";
import fc from "fast-check";
import DevicePinCode from "../../src/models/device-pin-code";

describe("DevicePinCode.isValidPin", () => {
  it("should accept exactly 6 digits", () => {
    expect(DevicePinCode.isValidPin("123456")).toBe(true);
    expect(DevicePinCode.isValidPin("000000")).toBe(true);
    expect(DevicePinCode.isValidPin("999999")).toBe(true);
  });

  it("should reject pins that are too short or too long", () => {
    expect(DevicePinCode.isValidPin("12345")).toBe(false);
    expect(DevicePinCode.isValidPin("1234567")).toBe(false);
    expect(DevicePinCode.isValidPin("")).toBe(false);
  });

  it("should reject non-digit characters", () => {
    expect(DevicePinCode.isValidPin("12345a")).toBe(false);
    expect(DevicePinCode.isValidPin("abcdef")).toBe(false);
    expect(DevicePinCode.isValidPin("12 345")).toBe(false);
    expect(DevicePinCode.isValidPin("12.345")).toBe(false);
  });

  it("property: only accepts strings of exactly 6 digits", () => {
    // Valid 6-digit strings should always pass
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), { minLength: 6, maxLength: 6 }).map((arr) => arr.join("")),
        (pin) => {
          expect(DevicePinCode.isValidPin(pin)).toBe(true);
        },
      ),
    );
  });

  it("property: rejects strings that are not exactly 6 digits", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !/^\d{6}$/.test(s)),
        (pin) => {
          expect(DevicePinCode.isValidPin(pin)).toBe(false);
        },
      ),
    );
  });
});

describe("DevicePinCode.hashPin", () => {
  it("should return a 64-character hex string (SHA-256)", () => {
    const hash = DevicePinCode.hashPin("123456");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should be deterministic", () => {
    expect(DevicePinCode.hashPin("123456")).toBe(DevicePinCode.hashPin("123456"));
  });

  it("should produce different hashes for different pins", () => {
    expect(DevicePinCode.hashPin("123456")).not.toBe(DevicePinCode.hashPin("654321"));
  });

  it("property: hash is always 64 hex chars", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const hash = DevicePinCode.hashPin(input);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }),
    );
  });

  it("property: same input always produces same hash", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(DevicePinCode.hashPin(input)).toBe(DevicePinCode.hashPin(input));
      }),
    );
  });
});

describe("DevicePinCode.PIN_LENGTH", () => {
  it("should be 6", () => {
    expect(DevicePinCode.PIN_LENGTH).toBe(6);
  });
});
