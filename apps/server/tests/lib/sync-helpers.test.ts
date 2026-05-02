import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { isEpochTimestamp } from "@/models/sync";

// `isDateColumn` is now schema-driven (queries `pg_catalog`) and requires a
// loaded cache, so its contract is exercised in
// `tests/integration/models/sync-methods.test.ts` against a real database.

describe("isEpochTimestamp", () => {
  it("accepts 10-digit epoch seconds as string", () => {
    expect(isEpochTimestamp("1678901234")).toBe(true);
  });

  it("accepts 13-digit epoch millis as string", () => {
    expect(isEpochTimestamp("1678901234567")).toBe(true);
  });

  it("accepts epoch seconds as number", () => {
    expect(isEpochTimestamp(1678901234)).toBe(true);
  });

  it("accepts epoch millis as number", () => {
    expect(isEpochTimestamp(1678901234567)).toBe(true);
  });

  it("rejects short numeric strings", () => {
    expect(isEpochTimestamp("12345")).toBe(false);
  });

  it("rejects ISO date strings", () => {
    expect(isEpochTimestamp("2024-01-15T00:00:00Z")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isEpochTimestamp(null)).toBe(false);
    expect(isEpochTimestamp(undefined)).toBe(false);
  });

  it("rejects numbers below 1e9", () => {
    expect(isEpochTimestamp(999999999)).toBe(false);
  });

  it("rejects numbers at or above 1e14", () => {
    expect(isEpochTimestamp(1e14)).toBe(false);
  });

  it("trims whitespace from string inputs", () => {
    expect(isEpochTimestamp("  1678901234  ")).toBe(true);
  });

  // Property: any 10-13 digit numeric string is accepted
  it("accepts all 10-13 digit numeric strings", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 13 }).chain((len) =>
          fc
            .array(fc.integer({ min: 0, max: 9 }), {
              minLength: len,
              maxLength: len,
            })
            .map((digits) => digits.join("")),
        ),
        (s) => {
          expect(isEpochTimestamp(s)).toBe(true);
        },
      ),
    );
  });

  // Property: numbers in valid epoch range are accepted
  it("accepts all numbers in the epoch range (1e9, 1e14)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e9 + 1, max: 1e14 - 1, noNaN: true }),
        (n) => {
          expect(isEpochTimestamp(n)).toBe(true);
        },
      ),
    );
  });

  // Property: strings that aren't purely digits are rejected
  it("rejects non-numeric strings", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !/^\s*\d{10,13}\s*$/.test(s)),
        (s) => {
          expect(isEpochTimestamp(s)).toBe(false);
        },
      ),
    );
  });
});

