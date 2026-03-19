import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import { sql } from "kysely";
import { v1 as uuidV1 } from "uuid";
import { testDb } from "../setup";

// IDs created during tests, cleaned up in afterEach
const createdPatientIds: string[] = [];

const arbPatient = () => ({
  id: uuidV1(),
  given_name: fc.sample(fc.string({ minLength: 1, maxLength: 20 }), 1)[0],
  surname: fc.sample(fc.string({ minLength: 1, maxLength: 20 }), 1)[0],
  date_of_birth: "1990-01-15",
  sex: "male" as const,
  citizenship: "US",
  phone: "555-0100",
  is_deleted: false,
});

const insertTestPatient = async (overrides: Record<string, unknown> = {}) => {
  const patient = { ...arbPatient(), ...overrides };
  createdPatientIds.push(patient.id);

  await testDb
    .insertInto("patients")
    .values({
      id: patient.id,
      given_name: patient.given_name,
      surname: patient.surname,
      date_of_birth: sql`${patient.date_of_birth}::date`,
      sex: patient.sex,
      citizenship: patient.citizenship,
      phone: patient.phone,
      is_deleted: patient.is_deleted,
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      server_created_at: sql`now()`,
      metadata: sql`'{}'::jsonb`,
    })
    .execute();

  return patient;
};

afterEach(async () => {
  if (createdPatientIds.length > 0) {
    await testDb
      .deleteFrom("patients")
      .where("id", "in", createdPatientIds)
      .execute();
    createdPatientIds.length = 0;
  }
});

describe("Patient model (integration)", () => {
  it("inserts and retrieves a patient by id", async () => {
    const patient = await insertTestPatient();

    const result = await testDb
      .selectFrom("patients")
      .selectAll()
      .where("id", "=", patient.id)
      .executeTakeFirst();

    expect(result).toBeDefined();
    expect(result!.id).toBe(patient.id);
    expect(result!.given_name).toBe(patient.given_name);
    expect(result!.surname).toBe(patient.surname);
    expect(result!.is_deleted).toBe(false);
  });

  it("soft-deletes a patient by setting is_deleted=true", async () => {
    const patient = await insertTestPatient();

    await testDb
      .updateTable("patients")
      .set({ is_deleted: true, updated_at: sql`now()`, last_modified: sql`now()` })
      .where("id", "=", patient.id)
      .execute();

    const result = await testDb
      .selectFrom("patients")
      .select(["id", "is_deleted"])
      .where("id", "=", patient.id)
      .executeTakeFirst();

    expect(result!.is_deleted).toBe(true);
  });

  it("generates unique IDs across multiple inserts", async () => {
    const ids = await Promise.all(
      Array.from({ length: 5 }, () => insertTestPatient()),
    );
    const uniqueIds = new Set(ids.map((p) => p.id));
    expect(uniqueIds.size).toBe(5);
  });
});
