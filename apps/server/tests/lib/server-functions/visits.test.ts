import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildVisitInsertValues,
  normalizePagination,
} from "../../../src/lib/server-functions/builders";

/** UUID format check that accepts all versions including v7 */
const isValidUUID = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

describe("buildVisitInsertValues", () => {
  it("always produces an object with id, patient_id, clinic_id, provider_id, and is_deleted=false", () => {
    fc.assert(
      fc.property(
        fc.record({
          patientId: fc.uuid(),
          clinicId: fc.uuid(),
          providerId: fc.uuid(),
          providerName: fc.option(fc.string(), { nil: null }),
          checkInTimestamp: fc.option(
            fc
              .date({ min: new Date("1900-01-01T00:00:00.000Z"), max: new Date("2099-12-31T23:59:59.999Z") })
              .filter((d) => !Number.isNaN(d.getTime()))
              .map((d) => d.toISOString()),
            {
              nil: null,
            },
          ),
        }),
        (input) => {
          const result = buildVisitInsertValues(input);

          expect(isValidUUID(result.id)).toBe(true);
          expect(result.patient_id).toBe(input.patientId);
          expect(result.clinic_id).toBe(input.clinicId);
          expect(result.provider_id).toBe(input.providerId);
          expect(result.is_deleted).toBe(false);
          expect(result.metadata).toEqual({});

          // Optional fields default to null
          expect(result.provider_name).toBe(input.providerName ?? null);
          // checkInTimestamp is either a valid ISO string or null
          if (input.checkInTimestamp) {
            expect(result.check_in_timestamp).toBe(input.checkInTimestamp);
          } else {
            expect(result.check_in_timestamp).toBeNull();
          }
        },
      ),
    );
  });

  it("uses provided visitId when given", () => {
    const customId = "550e8400-e29b-11d4-a716-446655440000";
    const result = buildVisitInsertValues(
      {
        patientId: "p1",
        clinicId: "c1",
        providerId: "pr1",
      },
      customId,
    );
    expect(result.id).toBe(customId);
  });

  it("generates unique ids across calls", () => {
    const input = {
      patientId: "p1",
      clinicId: "c1",
      providerId: "pr1",
    };
    const ids = new Set(
      Array.from({ length: 20 }, () => buildVisitInsertValues(input).id),
    );
    expect(ids.size).toBe(20);
  });

  it("passes through metadata when provided", () => {
    const meta = { source: "mobile", version: 2 };
    const result = buildVisitInsertValues({
      patientId: "p1",
      clinicId: "c1",
      providerId: "pr1",
      metadata: meta,
    });
    expect(result.metadata).toEqual(meta);
  });
});

describe("normalizePagination", () => {
  it("defaults offset to 0 and limit to 50 when not provided", () => {
    const result = normalizePagination();
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(50);
  });

  it("always returns non-negative offset and positive limit", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: -1000, max: 1000 }), { nil: undefined }),
        fc.option(fc.integer({ min: -1000, max: 1000 }), { nil: undefined }),
        (offset, limit) => {
          const result = normalizePagination(offset, limit);

          expect(result.offset).toBeGreaterThanOrEqual(0);
          expect(result.limit).toBeGreaterThanOrEqual(1);
        },
      ),
    );
  });

  it("preserves valid values", () => {
    expect(normalizePagination(10, 25)).toEqual({ offset: 10, limit: 25 });
  });

  it("clamps negative offset to 0", () => {
    expect(normalizePagination(-5, 25)).toEqual({ offset: 0, limit: 25 });
  });

  it("clamps zero/negative limit to 1", () => {
    expect(normalizePagination(0, 0)).toEqual({ offset: 0, limit: 1 });
    expect(normalizePagination(0, -10)).toEqual({ offset: 0, limit: 1 });
  });
});
