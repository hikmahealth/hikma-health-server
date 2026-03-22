import { describe, it, expect, vi, afterEach } from "vitest";
import { sql } from "kysely";
import { v1 as uuidV1 } from "uuid";
import { testDb } from "../setup";

vi.mock("@/db", () => ({ default: testDb }));

import Patient from "@/models/patient";
import Visit from "@/models/visit";
import Event from "@/models/event";
import Appointment from "@/models/appointment";
import Prescription from "@/models/prescription";

const createdIds: {
  prescriptions: string[];
  appointments: string[];
  events: string[];
  visits: string[];
  patients: string[];
  users: string[];
  clinics: string[];
} = {
  prescriptions: [],
  appointments: [],
  events: [],
  visits: [],
  patients: [],
  users: [],
  clinics: [],
};

// --- Shared fixtures ---

const insertClinic = async () => {
  const id = uuidV1();
  createdIds.clinics.push(id);
  await testDb
    .insertInto("clinics")
    .values({
      id,
      name: "Domain Test Clinic",
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

const insertUser = async (clinicId: string) => {
  const id = uuidV1();
  createdIds.users.push(id);
  await testDb
    .insertInto("users")
    .values({
      id,
      name: "Test Provider",
      role: "provider",
      email: `test-${id}@example.com`,
      hashed_password: "not-a-real-hash",
      instance_url: null,
      clinic_id: clinicId,
      is_deleted: false,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
      deleted_at: null,
    })
    .execute();
  return id;
};

const insertPatient = async (overrides: Record<string, unknown> = {}) => {
  const id = uuidV1();
  createdIds.patients.push(id);
  await testDb
    .insertInto("patients")
    .values({
      id,
      given_name: "Test",
      surname: "Patient",
      date_of_birth: sql`'1990-01-01'::date`,
      sex: "male",
      is_deleted: false,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
      metadata: sql`'{}'::jsonb`,
      ...overrides,
    })
    .execute();
  return id;
};

const insertVisit = async (patientId: string) => {
  const id = uuidV1();
  createdIds.visits.push(id);
  await testDb
    .insertInto("visits")
    .values({
      id,
      patient_id: patientId,
      is_deleted: false,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
      metadata: sql`'{}'::jsonb`,
    })
    .execute();
  return id;
};

const insertEvent = async (patientId: string, visitId: string) => {
  const id = uuidV1();
  createdIds.events.push(id);
  await testDb
    .insertInto("events")
    .values({
      id,
      patient_id: patientId,
      visit_id: visitId,
      form_data: sql`'[{"field": "initial"}]'::jsonb`,
      metadata: sql`'{}'::jsonb`,
      is_deleted: false,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
    })
    .execute();
  return id;
};

const insertAppointment = async (
  patientId: string,
  clinicId: string,
  visitId: string,
  userId: string,
) => {
  const id = uuidV1();
  createdIds.appointments.push(id);
  await testDb
    .insertInto("appointments")
    .values({
      id,
      patient_id: patientId,
      clinic_id: clinicId,
      provider_id: null,
      user_id: userId,
      current_visit_id: visitId,
      fulfilled_visit_id: null,
      timestamp: sql`now()`,
      duration: 30,
      reason: "Checkup",
      notes: "",
      status: "pending",
      departments: sql`'[]'::jsonb`,
      is_walk_in: false,
      metadata: sql`'{}'::jsonb`,
      is_deleted: false,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
      deleted_at: null,
    })
    .execute();
  return id;
};

const insertPrescription = async (
  patientId: string,
  clinicId: string,
  providerId: string,
) => {
  const id = uuidV1();
  createdIds.prescriptions.push(id);
  await testDb
    .insertInto("prescriptions")
    .values({
      id,
      patient_id: patientId,
      provider_id: providerId,
      filled_by: null,
      pickup_clinic_id: clinicId,
      visit_id: null,
      priority: "normal",
      expiration_date: null,
      prescribed_at: sql`now()`,
      filled_at: null,
      status: "pending",
      items: sql`'[]'::jsonb`,
      notes: "Take with food",
      metadata: sql`'{}'::jsonb`,
      is_deleted: false,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
      deleted_at: null,
    })
    .execute();
  return id;
};

// Cleanup in dependency order
afterEach(async () => {
  for (const id of createdIds.prescriptions)
    await testDb.deleteFrom("prescriptions").where("id", "=", id).execute();
  for (const id of createdIds.appointments)
    await testDb.deleteFrom("appointments").where("id", "=", id).execute();
  for (const id of createdIds.events)
    await testDb.deleteFrom("events").where("id", "=", id).execute();
  for (const id of createdIds.visits)
    await testDb.deleteFrom("visits").where("id", "=", id).execute();
  for (const id of createdIds.patients)
    await testDb.deleteFrom("patients").where("id", "=", id).execute();
  for (const id of createdIds.users)
    await testDb.deleteFrom("users").where("id", "=", id).execute();
  for (const id of createdIds.clinics)
    await testDb.deleteFrom("clinics").where("id", "=", id).execute();

  createdIds.prescriptions.length = 0;
  createdIds.appointments.length = 0;
  createdIds.events.length = 0;
  createdIds.visits.length = 0;
  createdIds.patients.length = 0;
  createdIds.users.length = 0;
  createdIds.clinics.length = 0;
});

// --- Tests ---

describe("Patient upsert (sync path)", () => {
  it("inserts then updates a patient via upsert", async () => {
    const patientId = await insertPatient({ given_name: "Original" });

    // Fetch the DB clock after the insert so updated_at in the upsert is
    // definitively ahead of the stored value, regardless of JS/DB clock skew.
    const { rows: [{ dbNow }] } = await sql<{ dbNow: Date }>`SELECT now() AS "dbNow"`.execute(testDb);
    const futureDate = new Date(dbNow.getTime() + 100);

    // Upsert with updated name — should update, not duplicate
    await Patient.API.DANGEROUS_SYNC_ONLY_upsert({
      id: patientId,
      given_name: "Updated",
      surname: "Patient",
      date_of_birth: new Date("1990-01-01"),
      sex: "male",
      citizenship: null,
      hometown: null,
      phone: null,
      camp: null,
      additional_data: {},
      image_timestamp: null,
      metadata: {},
      photo_url: null,
      government_id: null,
      external_patient_id: null,
      is_deleted: false,
      created_at: futureDate,
      updated_at: futureDate,
      last_modified: futureDate,
      server_created_at: futureDate,
      deleted_at: null,
      primary_clinic_id: null,
      last_modified_by: null,
      additional_attributes: {},
    } as Patient.EncodedT);

    const result = await testDb
      .selectFrom("patients")
      .select(["id", "given_name"])
      .where("id", "=", patientId)
      .executeTakeFirst();

    expect(result!.given_name).toBe("Updated");

    // Verify no duplicate row was created
    const count = await testDb
      .selectFrom("patients")
      .select(testDb.fn.countAll().as("count"))
      .where("id", "=", patientId)
      .executeTakeFirst();

    expect(Number(count!.count)).toBe(1);
  });
});

describe("Visit.API.getByPatientId", () => {
  it("returns paginated visits ordered by creation desc", async () => {
    const patientId = await insertPatient();
    // Insert 3 visits
    await insertVisit(patientId);
    await insertVisit(patientId);
    await insertVisit(patientId);

    const result = await Visit.API.getByPatientId({
      patientId,
      limit: 2,
      offset: 0,
    });

    expect(result.items).toHaveLength(2);
    expect(result.pagination.limit).toBe(2);
    expect(result.pagination.offset).toBe(0);
    // Note: the model uses `items.length > limit` for hasMore, which is
    // always false since the query itself limits results. This documents the
    // current behavior — hasMore is not reliable for Visit pagination.
    expect(result.pagination.hasMore).toBe(false);

    // Verify ordering is desc by created_at
    const first = result.items[0];
    const second = result.items[1];
    expect(new Date(first.created_at).getTime()).toBeGreaterThanOrEqual(
      new Date(second.created_at).getTime(),
    );
  });
});

describe("Event.API.updateFormData", () => {
  it("updates form_data and metadata on an existing event", async () => {
    const patientId = await insertPatient();
    const visitId = await insertVisit(patientId);
    const eventId = await insertEvent(patientId, visitId);

    const newFormData = [{ field: "bp", value: "120/80" }];
    const newMetadata = { source: "integration_test" };

    await Event.API.updateFormData(eventId, newFormData, newMetadata);

    const result = await testDb
      .selectFrom("events")
      .select(["form_data", "metadata"])
      .where("id", "=", eventId)
      .executeTakeFirst();

    expect(result!.form_data).toEqual(newFormData);
    expect(result!.metadata).toEqual(newMetadata);
  });
});

describe("Appointment.API.getById", () => {
  it("retrieves an appointment by id", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const patientId = await insertPatient();
    const visitId = await insertVisit(patientId);
    const appointmentId = await insertAppointment(
      patientId,
      clinicId,
      visitId,
      userId,
    );

    const result = await Appointment.API.getById(appointmentId);

    expect(result).toBeDefined();
    expect(result!.id).toBe(appointmentId);
    expect(result!.patient_id).toBe(patientId);
    expect(result!.clinic_id).toBe(clinicId);
    expect(result!.status).toBe("pending");
    expect(result!.duration).toBe(30);
    expect(result!.reason).toBe("Checkup");
  });
});

describe("Prescription.API.toggleStatus", () => {
  it("updates prescription status from pending to prepared", async () => {
    const clinicId = await insertClinic();
    const providerId = await insertUser(clinicId);
    const patientId = await insertPatient();
    const prescriptionId = await insertPrescription(patientId, clinicId, providerId);

    await Prescription.API.toggleStatus(prescriptionId, "prepared");

    const result = await testDb
      .selectFrom("prescriptions")
      .select(["id", "status"])
      .where("id", "=", prescriptionId)
      .executeTakeFirst();

    expect(result!.status).toBe("prepared");
  });
});
