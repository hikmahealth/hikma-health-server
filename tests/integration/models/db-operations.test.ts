import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { sql } from "kysely";
import { v1 as uuidV1 } from "uuid";
import { testDb } from "../setup";

// Mock the db module so all model code uses testDb
vi.mock("@/db", () => ({ default: testDb }));

// Import models after the mock so they pick up testDb
import Clinic from "@/models/clinic";
import Event from "@/models/event";
import Visit from "@/models/visit";

// Track created IDs for cleanup — order matters due to foreign keys
const createdIds: {
  events: string[];
  prescriptions: string[];
  appointments: string[];
  visits: string[];
  patients: string[];
  clinics: string[];
} = {
  events: [],
  prescriptions: [],
  appointments: [],
  visits: [],
  patients: [],
  clinics: [],
};

const insertTestClinic = async (overrides: Record<string, unknown> = {}) => {
  const id = uuidV1();
  createdIds.clinics.push(id);
  await testDb
    .insertInto("clinics")
    .values({
      id,
      name: "Test Clinic",
      is_deleted: false,
      is_archived: false,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
      deleted_at: null,
      ...overrides,
    })
    .execute();
  return id;
};

const insertTestPatient = async () => {
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
    })
    .execute();
  return id;
};

const insertTestVisit = async (patientId: string) => {
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

const insertTestEvent = async (patientId: string, visitId: string) => {
  const id = uuidV1();
  createdIds.events.push(id);
  await testDb
    .insertInto("events")
    .values({
      id,
      patient_id: patientId,
      visit_id: visitId,
      form_data: sql`'[]'::jsonb`,
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

// Cleanup in reverse dependency order
afterEach(async () => {
  for (const id of createdIds.events)
    await testDb.deleteFrom("events").where("id", "=", id).execute();
  for (const id of createdIds.prescriptions)
    await testDb.deleteFrom("prescriptions").where("id", "=", id).execute();
  for (const id of createdIds.appointments)
    await testDb.deleteFrom("appointments").where("id", "=", id).execute();
  for (const id of createdIds.visits)
    await testDb.deleteFrom("visits").where("id", "=", id).execute();
  for (const id of createdIds.patients)
    await testDb.deleteFrom("patients").where("id", "=", id).execute();
  for (const id of createdIds.clinics)
    await testDb.deleteFrom("clinics").where("id", "=", id).execute();

  createdIds.events.length = 0;
  createdIds.prescriptions.length = 0;
  createdIds.appointments.length = 0;
  createdIds.visits.length = 0;
  createdIds.patients.length = 0;
  createdIds.clinics.length = 0;
});

// --- Non-transaction methods ---

describe("Clinic.getById (no transaction)", () => {
  it("retrieves an existing clinic by id", async () => {
    const clinicId = await insertTestClinic({ name: "Rollback Clinic" });

    const result = await Clinic.getById(clinicId);

    expect(result).toBeDefined();
    expect(result.id).toBe(clinicId);
    expect(result.name).toBe("Rollback Clinic");
    expect(result.is_deleted).toBe(false);
  });

  it("throws when the clinic does not exist", async () => {
    const fakeId = uuidV1();
    await expect(Clinic.getById(fakeId)).rejects.toThrow();
  });
});

describe("Clinic.API.setArchivedStatus (no transaction)", () => {
  it("archives a clinic", async () => {
    const clinicId = await insertTestClinic();

    await Clinic.API.setArchivedStatus(clinicId, true);

    const result = await testDb
      .selectFrom("clinics")
      .select(["id", "is_archived"])
      .where("id", "=", clinicId)
      .executeTakeFirst();

    expect(result!.is_archived).toBe(true);
  });

  it("unarchives a clinic", async () => {
    const clinicId = await insertTestClinic({ is_archived: true });

    await Clinic.API.setArchivedStatus(clinicId, false);

    const result = await testDb
      .selectFrom("clinics")
      .select(["id", "is_archived"])
      .where("id", "=", clinicId)
      .executeTakeFirst();

    expect(result!.is_archived).toBe(false);
  });
});

describe("Event.API.softDelete (no transaction)", () => {
  it("soft-deletes an event by setting is_deleted=true", async () => {
    const patientId = await insertTestPatient();
    const visitId = await insertTestVisit(patientId);
    const eventId = await insertTestEvent(patientId, visitId);

    await Event.API.softDelete(eventId);

    const result = await testDb
      .selectFrom("events")
      .select(["id", "is_deleted"])
      .where("id", "=", eventId)
      .executeTakeFirst();

    expect(result).toBeDefined();
    expect(result!.is_deleted).toBe(true);
  });
});

// --- Transaction method ---

describe("Visit.API.softDelete (uses transaction)", () => {
  it("soft-deletes a visit and cascades to its events", async () => {
    const patientId = await insertTestPatient();
    const visitId = await insertTestVisit(patientId);
    const eventId = await insertTestEvent(patientId, visitId);

    await Visit.API.softDelete(visitId);

    const visit = await testDb
      .selectFrom("visits")
      .select(["id", "is_deleted"])
      .where("id", "=", visitId)
      .executeTakeFirst();

    const event = await testDb
      .selectFrom("events")
      .select(["id", "is_deleted"])
      .where("id", "=", eventId)
      .executeTakeFirst();

    expect(visit!.is_deleted).toBe(true);
    expect(event!.is_deleted).toBe(true);
  });
});
