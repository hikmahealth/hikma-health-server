import { Kysely, sql } from "kysely";

/**
 * Migration: restoring_patient_attribute_indices_and_primary_keys
 * Created at: 2024-07-11
 * Description: Restore primary keys and indices for patient_additional_attributes
 * Depends on: 20240603_patient_attribute_uuid_migration
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Make patient_id non-nullable
  await sql`
    ALTER TABLE patient_additional_attributes
    ALTER COLUMN patient_id SET NOT NULL;
  `.execute(db);

  // Create the primary key constraint
  await sql`
    ALTER TABLE patient_additional_attributes
    ADD CONSTRAINT patient_additional_attributes_pkey 
    PRIMARY KEY (patient_id, attribute_id);
  `.execute(db);

  // Create an index on patient_id
  await sql`
    CREATE INDEX ix_patient_additional_attributes_patient_id
    ON patient_additional_attributes (patient_id);
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the primary key constraint
  await sql`
    ALTER TABLE patient_additional_attributes
    DROP CONSTRAINT patient_additional_attributes_pkey;
  `.execute(db);

  // Drop the index
  await sql`
    DROP INDEX ix_patient_additional_attributes_patient_id;
  `.execute(db);

  // Make patient_id nullable
  await sql`
    ALTER TABLE patient_additional_attributes
    ALTER COLUMN patient_id DROP NOT NULL;
  `.execute(db);
}
