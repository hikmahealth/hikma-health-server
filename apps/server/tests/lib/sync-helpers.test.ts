import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { isEpochTimestamp, isDateColumn } from "@/models/sync";

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

describe("isDateColumn", () => {
  it("matches columns ending with _at", () => {
    expect(isDateColumn("created_at")).toBe(true);
    expect(isDateColumn("updated_at")).toBe(true);
    expect(isDateColumn("deleted_at")).toBe(true);
    expect(isDateColumn("server_created_at")).toBe(true);
  });

  it("matches columns ending with _date", () => {
    expect(isDateColumn("expiration_date")).toBe(true);
    expect(isDateColumn("date_of_birth_date")).toBe(true);
  });

  it("matches 'timestamp' exactly", () => {
    expect(isDateColumn("timestamp")).toBe(true);
  });

  it("matches 'last_modified' exactly", () => {
    expect(isDateColumn("last_modified")).toBe(true);
  });

  it("matches columns ending with _timestamp", () => {
    expect(isDateColumn("image_timestamp")).toBe(true);
    expect(isDateColumn("check_in_timestamp")).toBe(true);
  });

  it("matches columns ending with _datetime", () => {
    expect(isDateColumn("value_datetime")).toBe(true);
  });

  it("matches the EAV date_value column exactly", () => {
    expect(isDateColumn("date_value")).toBe(true);
  });

  it("matches date_of_birth exactly", () => {
    expect(isDateColumn("date_of_birth")).toBe(true);
  });

  it("rejects non-date columns", () => {
    expect(isDateColumn("name")).toBe(false);
    expect(isDateColumn("id")).toBe(false);
    expect(isDateColumn("status")).toBe(false);
    expect(isDateColumn("metadata")).toBe(false);
  });

  // The column-gate exists specifically to stop the sync cleaner from
  // rewriting these text columns with ISO timestamps when their values
  // happen to match the 10-13 digit epoch regex.
  it("rejects PHI text columns that often hold long digit strings", () => {
    expect(isDateColumn("phone")).toBe(false);
    expect(isDateColumn("government_id")).toBe(false);
    expect(isDateColumn("external_patient_id")).toBe(false);
  });

  it("rejects partial matches", () => {
    expect(isDateColumn("created_at_backup")).toBe(false);
    expect(isDateColumn("timestamp_field")).toBe(false);
  });

  // Property: any string ending with _at is a date column
  it("any column ending with _at is a date column", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map((s) => s.replace(/_at$/, "") + "_at"),
        (col) => {
          expect(isDateColumn(col)).toBe(true);
        },
      ),
    );
  });

  // Property: any string ending with _date is a date column
  it("any column ending with _date is a date column", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map((s) => s.replace(/_date$/, "") + "_date"),
        (col) => {
          expect(isDateColumn(col)).toBe(true);
        },
      ),
    );
  });
});
