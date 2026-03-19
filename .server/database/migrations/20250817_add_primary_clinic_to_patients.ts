import { Kysely, sql } from "kysely";

/**
 * Migration: add_primary_clinic_to_patients
 * Created at: 2025-08-17
 * Description: Add primary_clinic_id and last_modified_by columns to patients table
 * Depends on: 20250816_add_user_clinic_permissions
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("patients")
    .addColumn("primary_clinic_id", "uuid", (col) =>
      col.references("clinics.id").defaultTo(null),
    )
    .addColumn("last_modified_by", "uuid", (col) => col.references("users.id"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("patients")
    .dropColumn("primary_clinic_id")
    .dropColumn("last_modified_by")
    .execute();
}
