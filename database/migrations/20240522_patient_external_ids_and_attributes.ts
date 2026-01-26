import { Kysely, sql } from "kysely";

/**
 * Migration: patient_external_ids_and_attributes
 * Created at: 2024-05-22
 * Description: Add external ids to patients, and adopt EAV model for patient attributes
 * Depends on: 20191125_initial_user
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add new columns to the patients table
  await db.schema
    .alterTable("patients")
    .addColumn("government_id", "varchar(100)")
    .addColumn("external_patient_id", "varchar(100)")
    .execute();

  // Create patient_additional_attributes table
  await db.schema
    .createTable("patient_additional_attributes")
    .addColumn("id", "uuid", (col) => col.notNull())
    .addColumn("patient_id", "varchar", (col) => col.notNull())
    .addColumn("attribute_id", "varchar", (col) => col.notNull())
    .addColumn("attribute", "varchar", (col) => col.notNull().defaultTo(""))
    .addColumn("number_value", "float8")
    .addColumn("string_value", "varchar")
    .addColumn("date_value", "timestamptz")
    .addColumn("boolean_value", "boolean")
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("deleted_at", "timestamptz")
    .addPrimaryKeyConstraint("patient_additional_attributes_pkey", [
      "patient_id",
      "attribute_id",
    ])
    .execute();

  // Create indexes for patient_additional_attributes
  await db.schema
    .createIndex("ix_patient_additional_attributes_patient_id")
    .on("patient_additional_attributes")
    .column("patient_id")
    .execute();

  await db.schema
    .createIndex("ix_patient_additional_attributes_attribute_id")
    .on("patient_additional_attributes")
    .column("attribute_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop columns from patients table
  await db.schema
    .alterTable("patients")
    .dropColumn("government_id")
    .dropColumn("external_patient_id")
    .execute();

  // Drop patient_additional_attributes table
  await db.schema.dropTable("patient_additional_attributes").execute();
}
