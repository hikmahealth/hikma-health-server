import { Kysely, sql } from "kysely";

/**
 * Migration: add_prescriptions_table
 * Created at: 2024-09-26
 * Description: Add support for patient prescriptions
 * Depends on: 20240901_add_appointments_table
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create prescriptions table
  await db.schema
    .createTable("prescriptions")
    .addColumn("id", "uuid", (col) => col.primaryKey().notNull())
    .addColumn("patient_id", "uuid", (col) =>
      col.notNull().references("patients.id").notNull()
    )
    .addColumn("provider_id", "uuid", (col) =>
      col.notNull().references("users.id")
    )
    .addColumn("filled_by", "uuid", (col) => col.references("users.id"))
    .addColumn("pickup_clinic_id", "uuid", (col) =>
      col.notNull().references("clinics.id")
    )
    .addColumn("visit_id", "uuid", (col) => col.references("visits.id"))
    .addColumn("priority", "varchar", (col) => col.defaultTo("normal"))
    .addColumn("expiration_date", "timestamptz")
    .addColumn("prescribed_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("filled_at", "timestamptz")
    .addColumn("status", "varchar", (col) => col.notNull().defaultTo("pending"))
    .addColumn("items", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("notes", "varchar", (col) => col.notNull().defaultTo(""))
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("deleted_at", "timestamptz")
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // Create indexes
  await db.schema
    .createIndex("ix_prescriptions_patient_id")
    .on("prescriptions")
    .column("patient_id")
    .execute();

  await db.schema
    .createIndex("ix_prescriptions_pickup_clinic_id")
    .on("prescriptions")
    .column("pickup_clinic_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the prescriptions table and all its constraints
  await db.schema.dropTable("prescriptions").execute();
}
