import { describe, it, expect, vi, afterEach } from "vitest";
import { sql } from "kysely";
import { v1 as uuidV1 } from "uuid";
import { testDb } from "../setup";

vi.mock("@/db", () => ({ default: testDb }));

import Sync from "@/models/sync";
import type { RequestCaller } from "@/types";

// Track IDs for cleanup in dependency order
const createdIds: {
  patients: string[];
  visits: string[];
  clinics: string[];
  users: string[];
} = {
  patients: [],
  visits: [],
  clinics: [],
  users: [],
};

// --- Fixtures ---

const insertClinic = async () => {
  const id = uuidV1();
  createdIds.clinics.push(id);
  await testDb
    .insertInto("clinics")
    .values({
      id,
      name: "Sync Test Clinic",
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
      name: "Sync Test User",
      role: "provider",
      email: `sync-test-${id}@example.com`,
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
      given_name: "SyncMethod",
      surname: "TestPatient",
      date_of_birth: sql`'1985-06-15'::date`,
      sex: "female",
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

/** Build a minimal RequestCaller for mobile sync (user-based) */
const makeMobileCaller = (
  userId: string,
  clinicId: string,
): RequestCaller => ({
  user: {
    id: userId,
    name: "Sync Test User",
    role: "provider",
    email: "sync@test.com",
    clinic_id: clinicId,
  } as any,
  clinic: { id: clinicId, name: "Sync Test Clinic" } as any,
  token: "test-token",
});

// Cleanup in dependency order
afterEach(async () => {
  for (const id of createdIds.visits)
    await testDb.deleteFrom("visits").where("id", "=", id).execute();
  for (const id of createdIds.patients)
    await testDb.deleteFrom("patients").where("id", "=", id).execute();
  for (const id of createdIds.users)
    await testDb.deleteFrom("users").where("id", "=", id).execute();
  for (const id of createdIds.clinics)
    await testDb.deleteFrom("clinics").where("id", "=", id).execute();

  createdIds.visits.length = 0;
  createdIds.patients.length = 0;
  createdIds.users.length = 0;
  createdIds.clinics.length = 0;
});

// --- Tests ---

describe("Sync.getDeltaRecords (integration)", () => {
  it("returns new records in the created bucket", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const beforeInsert = Date.now();
    await new Promise((r) => setTimeout(r, 50));

    await insertPatient();

    const delta = await Sync.getDeltaRecords(beforeInsert, "mobile", caller);

    expect(delta.patients).toBeDefined();
    expect(delta.patients.created.length).toBeGreaterThanOrEqual(1);

    // Our test patient should be in the created bucket
    const found = delta.patients.created.find(
      (r: any) => r.given_name === "SyncMethod",
    );
    expect(found).toBeDefined();
    // Should NOT appear in updated or deleted
    expect(delta.patients.updated.find((r: any) => r.id === found.id)).toBeUndefined();
    expect(delta.patients.deleted).not.toContain(found.id);
  });

  it("returns updated records in the updated bucket", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const patientId = await insertPatient();

    await new Promise((r) => setTimeout(r, 50));
    const afterCreate = Date.now();
    await new Promise((r) => setTimeout(r, 50));

    // Update the patient
    await testDb
      .updateTable("patients")
      .set({ given_name: "UpdatedSync", last_modified: sql`now()` })
      .where("id", "=", patientId)
      .execute();

    const delta = await Sync.getDeltaRecords(afterCreate, "mobile", caller);

    expect(delta.patients.updated.length).toBeGreaterThanOrEqual(1);
    const found = delta.patients.updated.find((r: any) => r.id === patientId);
    expect(found).toBeDefined();
    expect(found.given_name).toBe("UpdatedSync");
  });

  it("returns soft-deleted record IDs in the deleted bucket", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const patientId = await insertPatient();

    await new Promise((r) => setTimeout(r, 50));
    const afterCreate = Date.now();
    await new Promise((r) => setTimeout(r, 50));

    // Soft delete
    await testDb
      .updateTable("patients")
      .set({
        is_deleted: true,
        deleted_at: sql`now()`,
        last_modified: sql`now()`,
      })
      .where("id", "=", patientId)
      .execute();

    const delta = await Sync.getDeltaRecords(afterCreate, "mobile", caller);

    expect(delta.patients.deleted).toContain(patientId);
  });

  it("skips deleted records on first sync (lastSyncedAt=0)", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const patientId = await insertPatient();

    // Soft delete
    await testDb
      .updateTable("patients")
      .set({
        is_deleted: true,
        deleted_at: sql`now()`,
        last_modified: sql`now()`,
      })
      .where("id", "=", patientId)
      .execute();

    // First sync should not include deleted IDs
    const delta = await Sync.getDeltaRecords(0, "mobile", caller);

    expect(delta.patients.deleted).not.toContain(patientId);
  });

  it("returns delta for multiple entity types", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const beforeInsert = Date.now();
    await new Promise((r) => setTimeout(r, 50));

    const patientId = await insertPatient();
    await insertVisit(patientId);

    const delta = await Sync.getDeltaRecords(beforeInsert, "mobile", caller);

    // Both patients and visits should have created records
    expect(delta.patients.created.length).toBeGreaterThanOrEqual(1);
    expect(delta.visits.created.length).toBeGreaterThanOrEqual(1);

    // All standard mobile entities should be present in the response
    expect(delta.patients).toBeDefined();
    expect(delta.visits).toBeDefined();
    expect(delta.events).toBeDefined();
    expect(delta.appointments).toBeDefined();
    expect(delta.prescriptions).toBeDefined();
  });
});

describe("Sync.persistClientChanges (integration)", () => {
  it("upserts a new patient from the created bucket", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const patientId = uuidV1();
    createdIds.patients.push(patientId);

    const pushData = {
      patients: {
        created: [
          {
            id: patientId,
            given_name: "PushedPatient",
            surname: "FromMobile",
            date_of_birth: "1992-03-15",
            sex: "male",
            citizenship: null,
            hometown: null,
            phone: null,
            camp: null,
            additional_data: "{}",
            image_timestamp: null,
            metadata: "{}",
            photo_url: null,
            government_id: null,
            external_patient_id: null,
            is_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified: new Date().toISOString(),
            server_created_at: new Date().toISOString(),
            deleted_at: null,
            primary_clinic_id: null,
            last_modified_by: null,
          },
        ],
        updated: [],
        deleted: [],
      },
    } as any;

    await Sync.persistClientChanges(pushData, "mobile", caller);

    const result = await testDb
      .selectFrom("patients")
      .select(["id", "given_name", "surname"])
      .where("id", "=", patientId)
      .executeTakeFirst();

    expect(result).toBeDefined();
    expect(result!.given_name).toBe("PushedPatient");
    expect(result!.surname).toBe("FromMobile");
  });

  it("strips unknown columns (e.g. WatermelonDB _status, _changed)", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const patientId = uuidV1();
    createdIds.patients.push(patientId);

    const pushData = {
      patients: {
        created: [
          {
            id: patientId,
            given_name: "CleanedPatient",
            surname: "NoExtraColumns",
            date_of_birth: "1990-01-01",
            sex: "female",
            citizenship: null,
            hometown: null,
            phone: null,
            camp: null,
            additional_data: "{}",
            image_timestamp: null,
            metadata: "{}",
            photo_url: null,
            government_id: null,
            external_patient_id: null,
            is_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified: new Date().toISOString(),
            server_created_at: new Date().toISOString(),
            deleted_at: null,
            primary_clinic_id: null,
            last_modified_by: null,
            // WatermelonDB columns that should be stripped
            _status: "created",
            _changed: "given_name,surname",
          },
        ],
        updated: [],
        deleted: [],
      },
    } as any;

    // Should not throw despite unknown columns
    await Sync.persistClientChanges(pushData, "mobile", caller);

    const result = await testDb
      .selectFrom("patients")
      .select(["id", "given_name"])
      .where("id", "=", patientId)
      .executeTakeFirst();

    expect(result).toBeDefined();
    expect(result!.given_name).toBe("CleanedPatient");
  });

  it("converts epoch timestamps to valid dates", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const patientId = uuidV1();
    createdIds.patients.push(patientId);

    const epochMs = Date.now();

    const pushData = {
      patients: {
        created: [
          {
            id: patientId,
            given_name: "EpochPatient",
            surname: "TimestampTest",
            date_of_birth: "1988-07-04",
            sex: "male",
            citizenship: null,
            hometown: null,
            phone: null,
            camp: null,
            additional_data: "{}",
            image_timestamp: null,
            metadata: "{}",
            photo_url: null,
            government_id: null,
            external_patient_id: null,
            is_deleted: false,
            // Send epoch millis instead of ISO strings
            created_at: String(epochMs),
            updated_at: String(epochMs),
            last_modified: String(epochMs),
            server_created_at: String(epochMs),
            deleted_at: null,
            primary_clinic_id: null,
            last_modified_by: null,
          },
        ],
        updated: [],
        deleted: [],
      },
    } as any;

    await Sync.persistClientChanges(pushData, "mobile", caller);

    const result = await testDb
      .selectFrom("patients")
      .select(["id", "created_at"])
      .where("id", "=", patientId)
      .executeTakeFirst();

    expect(result).toBeDefined();
    // The created_at should be a valid date, not the raw epoch string
    const createdAt = new Date(result!.created_at as any);
    expect(createdAt.getTime()).not.toBeNaN();
    // Should be close to the epoch we sent (within 5 seconds)
    expect(Math.abs(createdAt.getTime() - epochMs)).toBeLessThan(5000);
  });

  it("soft-deletes a record via the deleted bucket", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    // First insert a patient to delete
    const patientId = await insertPatient();

    const pushData = {
      patients: {
        created: [],
        updated: [],
        deleted: [patientId],
      },
    } as any;

    await Sync.persistClientChanges(pushData, "mobile", caller);

    const result = await testDb
      .selectFrom("patients")
      .select(["id", "is_deleted"])
      .where("id", "=", patientId)
      .executeTakeFirst();

    expect(result).toBeDefined();
    expect(result!.is_deleted).toBe(true);
  });

  it("ignores tables not in the accepted entity list", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    // Push data for an unknown table — should warn but not throw
    const pushData = {
      nonexistent_table: {
        created: [{ id: uuidV1(), name: "ghost" }],
        updated: [],
        deleted: [],
      },
    } as any;

    await expect(
      Sync.persistClientChanges(pushData, "mobile", caller),
    ).resolves.toBeUndefined();
  });
});

describe("Sync round-trip (integration)", () => {
  it("push then pull returns the same records", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const beforePush = Date.now();
    await new Promise((r) => setTimeout(r, 50));

    const patientId = uuidV1();
    createdIds.patients.push(patientId);

    // Push a patient via persistClientChanges
    const pushData = {
      patients: {
        created: [
          {
            id: patientId,
            given_name: "RoundTrip",
            surname: "TestPatient",
            date_of_birth: "1975-11-20",
            sex: "female",
            citizenship: "Testland",
            hometown: null,
            phone: "555-9999",
            camp: null,
            additional_data: "{}",
            image_timestamp: null,
            metadata: "{}",
            photo_url: null,
            government_id: null,
            external_patient_id: null,
            is_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified: new Date().toISOString(),
            server_created_at: new Date().toISOString(),
            deleted_at: null,
            primary_clinic_id: null,
            last_modified_by: null,
          },
        ],
        updated: [],
        deleted: [],
      },
    } as any;

    await Sync.persistClientChanges(pushData, "mobile", caller);

    // Pull back the delta
    const delta = await Sync.getDeltaRecords(beforePush, "mobile", caller);

    // The pushed patient should appear in the created bucket
    const found = delta.patients.created.find(
      (r: any) => r.id === patientId,
    );
    expect(found).toBeDefined();
    expect(found.given_name).toBe("RoundTrip");
    expect(found.surname).toBe("TestPatient");
    expect(found.phone).toBe("555-9999");
  });

  it("upsert idempotency: pushing the same record twice creates one row", async () => {
    const clinicId = await insertClinic();
    const userId = await insertUser(clinicId);
    const caller = makeMobileCaller(userId, clinicId);

    const patientId = uuidV1();
    createdIds.patients.push(patientId);

    const patientRecord = {
      id: patientId,
      given_name: "Idempotent",
      surname: "Patient",
      date_of_birth: "2000-01-01",
      sex: "male",
      citizenship: null,
      hometown: null,
      phone: null,
      camp: null,
      additional_data: "{}",
      image_timestamp: null,
      metadata: "{}",
      photo_url: null,
      government_id: null,
      external_patient_id: null,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
      server_created_at: new Date().toISOString(),
      deleted_at: null,
      primary_clinic_id: null,
      last_modified_by: null,
    };

    const pushData = {
      patients: {
        created: [patientRecord],
        updated: [],
        deleted: [],
      },
    } as any;

    // Push the same record twice
    await Sync.persistClientChanges(pushData, "mobile", caller);
    await Sync.persistClientChanges(pushData, "mobile", caller);

    // Should only have one row
    const count = await testDb
      .selectFrom("patients")
      .select(testDb.fn.countAll().as("count"))
      .where("id", "=", patientId)
      .executeTakeFirst();

    expect(Number(count!.count)).toBe(1);
  });
});
