import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildPatientInsertValues,
  buildPatientAttributeInsertValues,
  buildPatientUpdateSet,
} from "../../../src/lib/server-functions/builders";

/** UUID format check that accepts all versions including v7 */
const isValidUUID = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

describe("buildPatientInsertValues", () => {
  it("always produces an object with an id, is_deleted=false, and null defaults for missing fields", () => {
    fc.assert(
      fc.property(
        fc.record({
          given_name: fc.option(fc.string(), { nil: null }),
          surname: fc.option(fc.string(), { nil: null }),
          phone: fc.option(fc.string(), { nil: null }),
          sex: fc.option(fc.constantFrom("M", "F"), { nil: null }),
        }),
        (patient) => {
          const result = buildPatientInsertValues(patient);

          // Always has a valid UUID id
          expect(isValidUUID(result.id)).toBe(true);

          // is_deleted is always false for new patients
          expect(result.is_deleted).toBe(false);

          // Missing optional fields default to null
          expect(result.date_of_birth).toBeNull();
          expect(result.citizenship).toBeNull();
          expect(result.hometown).toBeNull();
          expect(result.camp).toBeNull();
          expect(result.government_id).toBeNull();
          expect(result.external_patient_id).toBeNull();
          expect(result.photo_url).toBeNull();
          expect(result.primary_clinic_id).toBeNull();

          // JSONB fields default to empty objects
          expect(result.additional_data).toEqual({});
          expect(result.metadata).toEqual({});

          // Provided fields are passed through
          expect(result.given_name).toBe(patient.given_name ?? null);
          expect(result.surname).toBe(patient.surname ?? null);
        },
      ),
    );
  });

  it("uses provided patientId when given", () => {
    const customId = "550e8400-e29b-11d4-a716-446655440000";
    const result = buildPatientInsertValues({}, customId);
    expect(result.id).toBe(customId);
  });

  it("generates a unique id each time when no id is provided", () => {
    const ids = new Set(
      Array.from({ length: 20 }, () => buildPatientInsertValues({}).id),
    );
    expect(ids.size).toBe(20);
  });

  it("passes through all provided fields", () => {
    const input = {
      given_name: "Jane",
      surname: "Doe",
      date_of_birth: "1990-01-15",
      sex: "F",
      citizenship: "US",
      hometown: "Springfield",
      phone: "+1234567890",
      camp: null,
      government_id: "GOV-123",
      external_patient_id: "EXT-456",
      additional_data: { blood_type: "O+" },
      metadata: { source: "online" },
      photo_url: "https://example.com/photo.jpg",
      primary_clinic_id: "clinic-abc",
    };

    const result = buildPatientInsertValues(input);

    expect(result.given_name).toBe("Jane");
    expect(result.surname).toBe("Doe");
    expect(result.date_of_birth).toBe("1990-01-15");
    expect(result.sex).toBe("F");
    expect(result.citizenship).toBe("US");
    expect(result.hometown).toBe("Springfield");
    expect(result.phone).toBe("+1234567890");
    expect(result.camp).toBeNull();
    expect(result.government_id).toBe("GOV-123");
    expect(result.external_patient_id).toBe("EXT-456");
    expect(result.additional_data).toEqual({ blood_type: "O+" });
    expect(result.metadata).toEqual({ source: "online" });
    expect(result.photo_url).toBe("https://example.com/photo.jpg");
    expect(result.primary_clinic_id).toBe("clinic-abc");
  });
});

describe("buildPatientAttributeInsertValues", () => {
  it("maps each attribute to the given patient ID with a unique UUID", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.record({
            attribute_id: fc.uuid(),
            attribute: fc.string({ minLength: 1 }),
            number_value: fc.option(fc.integer(), { nil: null }),
            string_value: fc.option(fc.string(), { nil: null }),
            boolean_value: fc.option(fc.boolean(), { nil: null }),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        (patientId, attrs) => {
          const result = buildPatientAttributeInsertValues(patientId, attrs);

          expect(result).toHaveLength(attrs.length);

          // Every attribute row has the correct patient_id
          for (const row of result) {
            expect(row.patient_id).toBe(patientId);
            expect(isValidUUID(row.id)).toBe(true);
            expect(row.is_deleted).toBe(false);
          }

          // All generated IDs are unique
          const ids = result.map((r) => r.id);
          expect(new Set(ids).size).toBe(ids.length);
        },
      ),
    );
  });

  it("returns empty array when no attributes provided", () => {
    const result = buildPatientAttributeInsertValues("some-id", []);
    expect(result).toEqual([]);
  });

  it("defaults missing optional values to null", () => {
    const result = buildPatientAttributeInsertValues("patient-123", [
      { attribute_id: "attr-1", attribute: "Blood Type" },
    ]);

    expect(result[0].number_value).toBeNull();
    expect(result[0].string_value).toBeNull();
    expect(result[0].date_value).toBeNull();
    expect(result[0].boolean_value).toBeNull();
    expect(result[0].metadata).toEqual({});
  });
});

describe("buildPatientUpdateSet", () => {
  it("never includes undefined values and always includes timestamp sentinels", () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            given_name: fc.option(fc.string(), { nil: undefined }),
            surname: fc.option(fc.string(), { nil: undefined }),
            phone: fc.option(fc.string(), { nil: undefined }),
            sex: fc.option(fc.constantFrom("M", "F", null), {
              nil: undefined,
            }),
          },
          { requiredKeys: [] },
        ),
        (fields) => {
          const result = buildPatientUpdateSet(fields);

          // No value should be undefined
          for (const value of Object.values(result)) {
            expect(value).not.toBeUndefined();
          }

          // Timestamp sentinels are always present
          expect(result._updated_at).toBe("NOW");
          expect(result._last_modified).toBe("NOW");
        },
      ),
    );
  });

  it("only includes keys that were provided (not undefined)", () => {
    const result = buildPatientUpdateSet({
      given_name: "Updated",
      // surname not provided — should not appear
    });

    expect(result.given_name).toBe("Updated");
    expect("surname" in result).toBe(false);
  });

  it("includes null values when explicitly provided", () => {
    const result = buildPatientUpdateSet({
      phone: null,
      camp: null,
    });

    expect(result.phone).toBeNull();
    expect(result.camp).toBeNull();
  });
});
