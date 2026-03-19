import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildEventInsertValues,
  buildEventUpdateSet,
} from "../../../src/lib/server-functions/builders";

/** UUID format check that accepts all versions including v7 */
const isValidUUID = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

describe("buildEventInsertValues", () => {
  it("always includes a non-null visit_id (required field)", () => {
    fc.assert(
      fc.property(
        fc.record({
          patientId: fc.uuid(),
          visitId: fc.uuid(),
          eventType: fc.option(fc.string(), { nil: null }),
          formId: fc.option(fc.uuid(), { nil: null }),
          formData: fc.array(
            fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
            { minLength: 0, maxLength: 3 },
          ),
        }),
        (input) => {
          const result = buildEventInsertValues(input);

          // visit_id is never null
          expect(result.visit_id).toBe(input.visitId);
          expect(result.visit_id).not.toBeNull();

          // Always has valid UUID id
          expect(isValidUUID(result.id)).toBe(true);

          // Required fields present
          expect(result.patient_id).toBe(input.patientId);
          expect(result.is_deleted).toBe(false);

          // form_data is always the provided array
          expect(result.form_data).toEqual(input.formData);

          // Optional fields default to null
          expect(result.event_type).toBe(input.eventType ?? null);
          expect(result.form_id).toBe(input.formId ?? null);
          expect(result.metadata).toEqual({});
          expect(result.recorded_by_user_id).toBeNull();
        },
      ),
    );
  });

  it("uses provided eventId and recordedByUserId", () => {
    const customId = "550e8400-e29b-11d4-a716-446655440000";
    const userId = "user-abc-123";

    const result = buildEventInsertValues(
      {
        patientId: "p1",
        visitId: "v1",
        formData: [],
      },
      { eventId: customId, recordedByUserId: userId },
    );

    expect(result.id).toBe(customId);
    expect(result.recorded_by_user_id).toBe(userId);
  });

  it("generates unique ids across calls", () => {
    const input = {
      patientId: "p1",
      visitId: "v1",
      formData: [],
    };
    const ids = new Set(
      Array.from({ length: 20 }, () => buildEventInsertValues(input).id),
    );
    expect(ids.size).toBe(20);
  });

  it("passes through metadata when provided", () => {
    const meta = { provider: "Dr. Smith", device: "tablet-01" };
    const result = buildEventInsertValues({
      patientId: "p1",
      visitId: "v1",
      formData: [{ field1: "value1" }],
      metadata: meta,
    });
    expect(result.metadata).toEqual(meta);
  });
});

describe("buildEventUpdateSet", () => {
  it("always includes form_data and excludes metadata when not provided", () => {
    const formData = [{ question: "answer" }];
    const result = buildEventUpdateSet({ id: "e1", formData });

    expect(result.form_data).toEqual(formData);
    expect("metadata" in result).toBe(false);
  });

  it("includes metadata when explicitly provided", () => {
    const formData = [{ q: "a" }];
    const meta = { updated: true };
    const result = buildEventUpdateSet({
      id: "e1",
      formData,
      metadata: meta,
    });

    expect(result.form_data).toEqual(formData);
    expect(result.metadata).toEqual(meta);
  });

  it("form_data round-trips through JSON serialization", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.dictionary(
            fc.string({ minLength: 1 }),
            fc.oneof(fc.string(), fc.integer(), fc.boolean()),
          ),
          { minLength: 0, maxLength: 5 },
        ),
        (formData) => {
          const result = buildEventUpdateSet({ id: "e1", formData });

          // Round-trip: JSON.parse(JSON.stringify(x)) should equal x
          const roundTripped = JSON.parse(JSON.stringify(result.form_data));
          expect(roundTripped).toEqual(formData);
        },
      ),
    );
  });

  it("handles empty formData array", () => {
    const result = buildEventUpdateSet({ id: "e1", formData: [] });

    expect(result.form_data).toEqual([]);
    expect(JSON.stringify(result.form_data)).toBe("[]");
  });

  it("includes metadata as empty object when explicitly set to empty", () => {
    const result = buildEventUpdateSet({
      id: "e1",
      formData: [],
      metadata: {},
    });

    expect(result.metadata).toEqual({});
  });
});
