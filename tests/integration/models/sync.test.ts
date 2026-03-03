import { describe, it, expect, afterEach } from "vitest";
import { sql } from "kysely";
import { v1 as uuidV1 } from "uuid";
import { testDb } from "../setup";

const createdIds: { patients: string[]; visits: string[] } = {
  patients: [],
  visits: [],
};

const insertTestPatient = async (overrides: Record<string, unknown> = {}) => {
  const id = uuidV1();
  createdIds.patients.push(id);
  await testDb
    .insertInto("patients")
    .values({
      id,
      given_name: "SyncTest",
      surname: "Patient",
      date_of_birth: sql`'1980-03-20'::date`,
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

afterEach(async () => {
  for (const id of createdIds.visits)
    await testDb.deleteFrom("visits").where("id", "=", id).execute();
  for (const id of createdIds.patients)
    await testDb.deleteFrom("patients").where("id", "=", id).execute();
  createdIds.patients.length = 0;
  createdIds.visits.length = 0;
});

describe("Sync model (integration)", () => {
  it("new records have server_created_at set", async () => {
    const id = await insertTestPatient();

    const result = await testDb
      .selectFrom("patients")
      .select(["id", "server_created_at", "last_modified"])
      .where("id", "=", id)
      .executeTakeFirst();

    expect(result).toBeDefined();
    expect(result!.server_created_at).toBeDefined();
    expect(result!.last_modified).toBeDefined();
  });

  it("delta query finds new records after a timestamp", async () => {
    const beforeInsert = new Date();

    // Small delay to ensure server_created_at > beforeInsert
    await new Promise((r) => setTimeout(r, 50));

    const id = await insertTestPatient();

    const results = await testDb
      .selectFrom("patients")
      .selectAll()
      .where("server_created_at", ">", beforeInsert)
      .where("is_deleted", "=", false)
      .execute();

    const found = results.find((r) => r.id === id);
    expect(found).toBeDefined();
  });

  it("delta query finds updated records", async () => {
    const id = await insertTestPatient();

    // Record the time after creation
    await new Promise((r) => setTimeout(r, 50));
    const afterCreate = new Date();
    await new Promise((r) => setTimeout(r, 50));

    // Update the record
    await testDb
      .updateTable("patients")
      .set({
        given_name: "Updated",
        last_modified: sql`now()`,
      })
      .where("id", "=", id)
      .execute();

    // Query for updates after afterCreate
    const updated = await testDb
      .selectFrom("patients")
      .selectAll()
      .where("last_modified", ">", afterCreate)
      .where("server_created_at", "<", afterCreate)
      .where("is_deleted", "=", false)
      .execute();

    const found = updated.find((r) => r.id === id);
    expect(found).toBeDefined();
    expect(found!.given_name).toBe("Updated");
  });

  it("delta query finds soft-deleted records", async () => {
    const id = await insertTestPatient();
    await new Promise((r) => setTimeout(r, 50));
    const afterCreate = new Date();
    await new Promise((r) => setTimeout(r, 50));

    // Soft delete
    await testDb
      .updateTable("patients")
      .set({
        is_deleted: true,
        deleted_at: sql`now()`,
        last_modified: sql`now()`,
      })
      .where("id", "=", id)
      .execute();

    const deleted = await testDb
      .selectFrom("patients")
      .selectAll()
      .where("deleted_at", ">", afterCreate)
      .where("is_deleted", "=", true)
      .execute();

    const found = deleted.find((r) => r.id === id);
    expect(found).toBeDefined();
  });
});
