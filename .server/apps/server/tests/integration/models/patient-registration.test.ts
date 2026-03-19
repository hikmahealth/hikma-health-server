import { describe, it, expect, vi, afterEach } from "vitest";
import { sql } from "kysely";
import { v1 as uuidV1 } from "uuid";
import { testDb } from "../setup";

vi.mock("@/db", () => ({ default: testDb }));

import db from "@/db";
import {
  buildPatientInsertValues,
  buildPatientAttributeInsertValues,
} from "@/lib/server-functions/builders";
import Patient from "@/models/patient";
import PatientAdditionalAttribute from "@/models/patient-additional-attribute";

// Track IDs for cleanup — attributes before patients, patients before clinics/forms
const createdIds: {
  attributes: string[];
  patients: string[];
  clinics: string[];
  registrationForms: string[];
} = {
  attributes: [],
  patients: [],
  clinics: [],
  registrationForms: [],
};

// --- Test fixtures ---

const insertTestClinic = async (name = "Registration Test Clinic") => {
  const id = uuidV1();
  createdIds.clinics.push(id);
  await testDb
    .insertInto("clinics")
    .values({
      id,
      name,
      is_deleted: false,
      is_archived: false,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
      deleted_at: null,
    })
    .execute();
  return id;
};

/**
 * Insert a registration form with the standard base fields plus custom attribute fields.
 * The custom fields use `baseField: false` and define the attribute_id that links to
 * patient_additional_attributes rows.
 */
const insertTestRegistrationForm = async (clinicId: string) => {
  const formId = uuidV1();
  const bloodTypeFieldId = uuidV1();
  const allergiesFieldId = uuidV1();

  const fields = [
    // Base fields (subset — enough to validate the pattern)
    {
      id: "e3d7615c-6ee6-11ee-b962-0242ac120002",
      position: 1,
      column: "given_name",
      label: { en: "First Name" },
      fieldType: "text",
      options: [],
      required: true,
      baseField: true,
      visible: true,
      deleted: false,
      showsInSummary: true,
      isSearchField: false,
    },
    {
      id: "128faebe-6ee7-11ee-b962-0242ac120002",
      position: 2,
      column: "surname",
      label: { en: "Last Name" },
      fieldType: "text",
      options: [],
      required: true,
      baseField: true,
      visible: true,
      deleted: false,
      showsInSummary: true,
      isSearchField: false,
    },
    {
      id: "417d5df8-6eeb-11ee-b962-0242ac120002",
      position: 3,
      column: "date_of_birth",
      label: { en: "Date of Birth" },
      fieldType: "date",
      options: [],
      required: true,
      baseField: true,
      visible: true,
      deleted: false,
      showsInSummary: true,
      isSearchField: true,
    },
    {
      id: "4b9190de-6eeb-11ee-b962-0242ac120002",
      position: 4,
      column: "sex",
      label: { en: "Sex" },
      fieldType: "select",
      options: [{ en: "male" }, { en: "female" }],
      required: true,
      baseField: true,
      visible: true,
      deleted: false,
      showsInSummary: true,
      isSearchField: true,
    },
    // Custom attribute fields — these map to patient_additional_attributes
    {
      id: bloodTypeFieldId,
      position: 5,
      column: "blood_type",
      label: { en: "Blood Type" },
      fieldType: "select",
      options: [{ en: "A+" }, { en: "B+" }, { en: "O-" }],
      required: false,
      baseField: false,
      visible: true,
      deleted: false,
      showsInSummary: true,
      isSearchField: false,
    },
    {
      id: allergiesFieldId,
      position: 6,
      column: "allergies",
      label: { en: "Allergies" },
      fieldType: "text",
      options: [],
      required: false,
      baseField: false,
      visible: true,
      deleted: false,
      showsInSummary: false,
      isSearchField: true,
    },
  ];

  createdIds.registrationForms.push(formId);
  await testDb
    .insertInto("patient_registration_forms")
    .values({
      id: formId,
      clinic_id: clinicId,
      name: "Test Registration Form",
      fields: sql`${JSON.stringify(fields)}::jsonb`,
      metadata: sql`'{}'::jsonb`,
      is_deleted: false,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
      deleted_at: null,
    })
    .execute();

  return { formId, bloodTypeFieldId, allergiesFieldId };
};

/**
 * Runs the same transaction the create_patient tRPC procedure uses:
 * insert patient + attributes atomically.
 */
const registerPatient = async (
  input: Parameters<typeof buildPatientInsertValues>[0],
  additionalAttributes: Parameters<typeof buildPatientAttributeInsertValues>[1] = [],
) => {
  const values = buildPatientInsertValues(input);
  const patientId = values.id;
  createdIds.patients.push(patientId);

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto(Patient.Table.name)
      .values({
        id: values.id,
        given_name: values.given_name,
        surname: values.surname,
        date_of_birth: values.date_of_birth
          ? sql`${values.date_of_birth}::date`
          : null,
        citizenship: values.citizenship,
        hometown: values.hometown,
        phone: values.phone,
        sex: values.sex,
        camp: values.camp,
        additional_data: sql`${JSON.stringify(values.additional_data)}::jsonb`,
        metadata: sql`${JSON.stringify(values.metadata)}::jsonb`,
        photo_url: values.photo_url,
        government_id: values.government_id,
        external_patient_id: values.external_patient_id,
        primary_clinic_id: values.primary_clinic_id,
        is_deleted: false,
        created_at: sql`now()::timestamp with time zone`,
        updated_at: sql`now()::timestamp with time zone`,
        last_modified: sql`now()::timestamp with time zone`,
        server_created_at: sql`now()::timestamp with time zone`,
        deleted_at: null,
      })
      .executeTakeFirstOrThrow();

    if (additionalAttributes.length > 0) {
      const attrValues = buildPatientAttributeInsertValues(
        patientId,
        additionalAttributes,
      );
      for (const attr of attrValues) {
        createdIds.attributes.push(attr.id);
        await trx
          .insertInto(PatientAdditionalAttribute.Table.name)
          .values({
            id: attr.id,
            patient_id: attr.patient_id,
            attribute_id: attr.attribute_id,
            attribute: attr.attribute,
            number_value: attr.number_value,
            string_value: attr.string_value,
            date_value: attr.date_value
              ? sql`${attr.date_value}::timestamp with time zone`
              : null,
            boolean_value: attr.boolean_value,
            metadata: sql`${JSON.stringify(attr.metadata)}::jsonb`,
            is_deleted: false,
            created_at: sql`now()::timestamp with time zone`,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
            server_created_at: sql`now()::timestamp with time zone`,
            deleted_at: null,
          })
          .executeTakeFirst();
      }
    }
  });

  return patientId;
};

// Cleanup in dependency order
afterEach(async () => {
  for (const id of createdIds.attributes)
    await testDb
      .deleteFrom("patient_additional_attributes")
      .where("id", "=", id)
      .execute();
  for (const id of createdIds.patients)
    await testDb.deleteFrom("patients").where("id", "=", id).execute();
  for (const id of createdIds.registrationForms)
    await testDb
      .deleteFrom("patient_registration_forms")
      .where("id", "=", id)
      .execute();
  for (const id of createdIds.clinics)
    await testDb.deleteFrom("clinics").where("id", "=", id).execute();

  createdIds.attributes.length = 0;
  createdIds.patients.length = 0;
  createdIds.registrationForms.length = 0;
  createdIds.clinics.length = 0;
});

// --- Tests ---

describe("Patient registration (integration)", () => {
  it("registers a patient with base fields only", async () => {
    const clinicId = await insertTestClinic();
    await insertTestRegistrationForm(clinicId);

    const patientId = await registerPatient({
      given_name: "Ada",
      surname: "Lovelace",
      date_of_birth: "1815-12-10",
      sex: "female",
      citizenship: "British",
      phone: "555-1815",
      primary_clinic_id: clinicId,
    });

    const patient = await testDb
      .selectFrom("patients")
      .selectAll()
      .where("id", "=", patientId)
      .executeTakeFirst();

    expect(patient).toBeDefined();
    expect(patient!.given_name).toBe("Ada");
    expect(patient!.surname).toBe("Lovelace");
    expect(patient!.sex).toBe("female");
    expect(patient!.primary_clinic_id).toBe(clinicId);
    expect(patient!.is_deleted).toBe(false);
  });

  it("registers a patient with additional attributes in a single transaction", async () => {
    const clinicId = await insertTestClinic();
    const { bloodTypeFieldId, allergiesFieldId } =
      await insertTestRegistrationForm(clinicId);

    const patientId = await registerPatient(
      {
        given_name: "Grace",
        surname: "Hopper",
        date_of_birth: "1906-12-09",
        sex: "female",
        primary_clinic_id: clinicId,
      },
      [
        {
          attribute_id: bloodTypeFieldId,
          attribute: "blood_type",
          string_value: "O-",
        },
        {
          attribute_id: allergiesFieldId,
          attribute: "allergies",
          string_value: "Penicillin",
        },
      ],
    );

    // Verify patient row
    const patient = await testDb
      .selectFrom("patients")
      .selectAll()
      .where("id", "=", patientId)
      .executeTakeFirst();

    expect(patient).toBeDefined();
    expect(patient!.given_name).toBe("Grace");

    // Verify both attributes were created and linked to the patient
    const attributes = await testDb
      .selectFrom("patient_additional_attributes")
      .selectAll()
      .where("patient_id", "=", patientId)
      .orderBy("attribute", "asc")
      .execute();

    expect(attributes).toHaveLength(2);
    expect(attributes[0].attribute).toBe("allergies");
    expect(attributes[0].string_value).toBe("Penicillin");
    expect(attributes[0].attribute_id).toBe(allergiesFieldId);
    expect(attributes[1].attribute).toBe("blood_type");
    expect(attributes[1].string_value).toBe("O-");
    expect(attributes[1].attribute_id).toBe(bloodTypeFieldId);
  });

  it("attributes reference the registration form field IDs", async () => {
    const clinicId = await insertTestClinic();
    const { bloodTypeFieldId } =
      await insertTestRegistrationForm(clinicId);

    const patientId = await registerPatient(
      { given_name: "Test", surname: "Patient", sex: "male", primary_clinic_id: clinicId },
      [{ attribute_id: bloodTypeFieldId, attribute: "blood_type", string_value: "A+" }],
    );

    // The attribute_id in patient_additional_attributes should match
    // the field id defined in the registration form
    const attr = await testDb
      .selectFrom("patient_additional_attributes")
      .select(["attribute_id", "string_value"])
      .where("patient_id", "=", patientId)
      .executeTakeFirst();

    expect(attr).toBeDefined();
    expect(attr!.attribute_id).toBe(bloodTypeFieldId);

    // Verify this field id exists in the registration form
    const form = await testDb
      .selectFrom("patient_registration_forms")
      .select("fields")
      .where("clinic_id", "=", clinicId)
      .executeTakeFirst();

    const formFieldIds = (form!.fields as any[]).map((f: any) => f.id);
    expect(formFieldIds).toContain(bloodTypeFieldId);
  });

  it("retrieves a patient with attributes joined correctly", async () => {
    const clinicId = await insertTestClinic();
    const { bloodTypeFieldId, allergiesFieldId } =
      await insertTestRegistrationForm(clinicId);

    const patientId = await registerPatient(
      {
        given_name: "Alan",
        surname: "Turing",
        sex: "male",
        primary_clinic_id: clinicId,
      },
      [
        { attribute_id: bloodTypeFieldId, attribute: "blood_type", string_value: "B+" },
        { attribute_id: allergiesFieldId, attribute: "allergies", string_value: "None" },
      ],
    );

    // Use the same join query pattern the app uses to fetch patient + attributes
    const result = await testDb.executeQuery(
      sql`
        SELECT
          p.*,
          COALESCE(json_object_agg(
            pa.attribute_id,
            json_build_object(
              'attribute', pa.attribute,
              'number_value', pa.number_value,
              'string_value', pa.string_value,
              'date_value', pa.date_value,
              'boolean_value', pa.boolean_value
            )
          ) FILTER (WHERE pa.attribute_id IS NOT NULL), '{}') AS additional_attributes
        FROM patients p
        LEFT JOIN patient_additional_attributes pa ON p.id = pa.patient_id
        WHERE p.id = ${patientId}
        GROUP BY p.id
      `.compile(testDb),
    );

    const row = result.rows[0] as any;
    expect(row).toBeDefined();
    expect(row.given_name).toBe("Alan");
    expect(row.additional_attributes[bloodTypeFieldId].string_value).toBe("B+");
    expect(row.additional_attributes[allergiesFieldId].string_value).toBe("None");
    expect(row.additional_attributes[allergiesFieldId].attribute).toBe("allergies");
  });
});
