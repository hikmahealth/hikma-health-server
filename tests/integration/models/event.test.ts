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
      given_name: "EventTest",
      surname: "Patient",
      date_of_birth: sql`'1985-06-15'::date`,
      sex: "female",
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

const insertTestEvent = async (
  patientId: string,
  visitId: string,
  formData: unknown[] = [{ field: "test_value" }],
) => {
  const id = uuidV1();
  createdIds.events.push(id);
  await testDb
    .insertInto("events")
    .values({
      id,
      patient_id: patientId,
      visit_id: visitId,
      form_data: sql`${JSON.stringify(formData)}::jsonb`,
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

describe("Event model (integration)", () => {
  it("inserts an event and retrieves it", async () => {
    const patientId = await insertTestPatient();
    const visitId = await insertTestVisit(patientId);
    const eventId = await insertTestEvent(patientId, visitId);

    const result = await testDb
      .selectFrom("events")
      .selectAll()
      .where("id", "=", eventId)
      .executeTakeFirst();

    expect(result).toBeDefined();
    expect(result!.patient_id).toBe(patientId);
    expect(result!.visit_id).toBe(visitId);
    expect(result!.is_deleted).toBe(false);
  });

  it("retrieves all events for a visit", async () => {
    const patientId = await insertTestPatient();
    const visitId = await insertTestVisit(patientId);
    await insertTestEvent(patientId, visitId, [{ q: "a1" }]);
    await insertTestEvent(patientId, visitId, [{ q: "a2" }]);

    const results = await testDb
      .selectFrom("events")
      .selectAll()
      .where("visit_id", "=", visitId)
      .where("is_deleted", "=", false)
      .execute();

    expect(results).toHaveLength(2);
  });

  it("stores and retrieves JSONB form_data correctly", async () => {
    const patientId = await insertTestPatient();
    const visitId = await insertTestVisit(patientId);
    const formData = [
      { field_id: "bp", value: "120/80" },
      { field_id: "weight", value: "70" },
    ];
    const eventId = await insertTestEvent(patientId, visitId, formData);

    const result = await testDb
      .selectFrom("events")
      .select("form_data")
      .where("id", "=", eventId)
      .executeTakeFirst();

    expect(result!.form_data).toEqual(formData);
  });

  it("soft-deletes an event", async () => {
    const patientId = await insertTestPatient();
    const visitId = await insertTestVisit(patientId);
    const eventId = await insertTestEvent(patientId, visitId);

    await testDb
      .updateTable("events")
      .set({ is_deleted: true, updated_at: sql`now()`, last_modified: sql`now()` })
      .where("id", "=", eventId)
      .execute();

    const result = await testDb
      .selectFrom("events")
      .select(["id", "is_deleted"])
      .where("id", "=", eventId)
      .executeTakeFirst();

    expect(result!.is_deleted).toBe(true);
  });
});
