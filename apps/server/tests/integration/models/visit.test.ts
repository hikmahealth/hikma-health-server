import { describe, it, expect, afterEach } from "vitest";
import { sql } from "kysely";
import { v1 as uuidV1 } from "uuid";
import { testDb } from "../setup";

const createdIds: { patients: string[]; visits: string[]; events: string[] } = {
  patients: [],
  visits: [],
  events: [],
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

afterEach(async () => {
  for (const id of createdIds.events)
    await testDb.deleteFrom("events").where("id", "=", id).execute();
  for (const id of createdIds.visits)
    await testDb.deleteFrom("visits").where("id", "=", id).execute();
  for (const id of createdIds.patients)
    await testDb.deleteFrom("patients").where("id", "=", id).execute();
  createdIds.patients.length = 0;
  createdIds.visits.length = 0;
  createdIds.events.length = 0;
});

describe("Visit model (integration)", () => {
  it("inserts and retrieves a visit", async () => {
    const patientId = await insertTestPatient();
    const visitId = await insertTestVisit(patientId);

    const result = await testDb
      .selectFrom("visits")
      .selectAll()
      .where("id", "=", visitId)
      .executeTakeFirst();

    expect(result).toBeDefined();
    expect(result!.patient_id).toBe(patientId);
    expect(result!.is_deleted).toBe(false);
  });

  it("retrieves visits for a patient ordered by creation", async () => {
    const patientId = await insertTestPatient();
    await insertTestVisit(patientId);
    await insertTestVisit(patientId);
    await insertTestVisit(patientId);

    const results = await testDb
      .selectFrom("visits")
      .selectAll()
      .where("patient_id", "=", patientId)
      .where("is_deleted", "=", false)
      .execute();

    expect(results).toHaveLength(3);
  });

  it("soft-deleting a visit cascades to events", async () => {
    const patientId = await insertTestPatient();
    const visitId = await insertTestVisit(patientId);
    const eventId = await insertTestEvent(patientId, visitId);

    // Soft delete the visit and its dependents
    await testDb.transaction().execute(async (trx) => {
      await trx
        .updateTable("visits")
        .set({ is_deleted: true, updated_at: sql`now()`, last_modified: sql`now()` })
        .where("id", "=", visitId)
        .execute();
      await trx
        .updateTable("events")
        .set({ is_deleted: true, updated_at: sql`now()`, last_modified: sql`now()` })
        .where("visit_id", "=", visitId)
        .execute();
    });

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
