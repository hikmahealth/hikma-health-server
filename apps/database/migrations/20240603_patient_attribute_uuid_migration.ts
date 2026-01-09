import { Kysely, sql } from "kysely";

/**
 * Migration: patient_attribute_uuid_migration
 * Created at: 2024-06-03
 * Description: Migrate patient attribute IDs to be UUIDs
 * Depends on: 20240522_patient_external_ids_and_attributes
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add a new UUID column
  await db.schema
    .alterTable("patient_additional_attributes")
    .addColumn("patient_uuid_column", "uuid")
    .execute();

  // Convert existing string values to UUID
  await sql`
    UPDATE patient_additional_attributes
    SET patient_uuid_column = patient_id::UUID
  `.execute(db);

  // Drop the old string column
  await db.schema
    .alterTable("patient_additional_attributes")
    .dropColumn("patient_id")
    .execute();

  // Rename the new UUID column to the original column name
  await db.schema
    .alterTable("patient_additional_attributes")
    .renameColumn("patient_uuid_column", "patient_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Add a temporary string column
  await db.schema
    .alterTable("patient_additional_attributes")
    .addColumn("patient_id_string", "varchar")
    .execute();

  // Convert UUID values back to string
  await sql`
    UPDATE patient_additional_attributes
    SET patient_id_string = patient_id::TEXT
  `.execute(db);

  // Drop the UUID column
  await db.schema
    .alterTable("patient_additional_attributes")
    .dropColumn("patient_id")
    .execute();

  // Rename the string column to the original column name
  await db.schema
    .alterTable("patient_additional_attributes")
    .renameColumn("patient_id_string", "patient_id")
    .execute();
}
