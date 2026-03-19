import { Kysely, sql } from "kysely";
import { randomUUID } from "crypto";

/**
 * Migration: initial_user
 * Created at: 2019-11-25 (file name is a day after to make clear the order for the migrations)
 * Description: Create initial admin user and clinic
 * Depends on: 20191125_initial_tables
 */
export async function up(db: Kysely<any>): Promise<void> {
  const clinic_id = randomUUID();

  // Insert the initial clinic
  await db
    .insertInto("clinics")
    .values({
      id: clinic_id,
      name: "Hikma Clinic",
    })
    .execute();

  // Insert the initial admin user
  await db
    .insertInto("users")
    .values({
      id: randomUUID(),
      clinic_id: clinic_id,
      name: "Hikma Admin",
      role: "super_admin",
      email: "admin@hikmahealth.org",
      hashed_password:
        "$2b$14$PPY9X2ZxFG93IU9CK4FUtOJW0d11zjHuODO6oJM5UNn59aXjp5h..",
      instance_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      is_deleted: false,
    })
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Delete the admin user
  await db
    .deleteFrom("users")
    .where("email", "=", "admin@hikmahealth.org")
    .execute();

  // The clinic will be automatically deleted due to cascading deletes if needed
  // But we can explicitly delete it as well
  await db.deleteFrom("clinics").where("name", "=", "Hikma Clinic").execute();
}
