import { Kysely } from "kysely";

/**
 * Migration: increase_sex_text_length
 * Created at: 2024-08-21
 * Description: Increase the length of the sex column in the patients table from 8 to 24 characters
 * Depends on: 20240603_patient_attribute_uuid_migration
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Alter the sex column to increase its length
  await db.schema
    .alterTable("patients")
    .alterColumn("sex", (col) => col.setDataType("varchar(24)"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Revert the sex column back to its original length
  await db.schema
    .alterTable("patients")
    .alterColumn("sex", (col) => col.setDataType("varchar(8)"))
    .execute();
}
