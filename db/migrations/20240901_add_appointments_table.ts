import { Kysely, sql } from "kysely";

/**
 * Migration: add_appointments_table
 * Created at: 2024-09-01
 * Description: Adding support for Appointments
 * Depends on: 20240821_increase_sex_text_length
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create appointments table
  await db.schema
    .createTable("appointments")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    // Provider ID is the user that the appointment is set for or the user that provided care when the appointment was fulfilled
    .addColumn("provider_id", "uuid", (col) => col.references("users.id"))
    .addColumn("clinic_id", "uuid", (col) =>
      col.notNull().references("clinics.id")
    )
    .addColumn("patient_id", "uuid", (col) =>
      col.notNull().references("patients.id")
    )
    // User ID is the user that created the current_visit_id
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id"))
    .addColumn("current_visit_id", "uuid", (col) =>
      col.notNull().references("visits.id")
    )
    .addColumn("fulfilled_visit_id", "uuid", (col) =>
      col.references("visits.id")
    )
    .addColumn("timestamp", "timestamptz", (col) => col.notNull())
    // Duration in minutes, defaults to 60 minutes
    .addColumn("duration", "smallint", (col) => col.notNull().defaultTo(60))
    .addColumn("reason", "varchar", (col) => col.notNull().defaultTo(""))
    .addColumn("notes", "varchar", (col) => col.notNull().defaultTo(""))
    // Status can be pending, confirmed, cancelled, or completed
    .addColumn("status", "varchar", (col) => col.notNull().defaultTo("pending"))
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
    .execute();

  // Create index on timestamp
  await db.schema
    .createIndex("ix_timestamp")
    .on("appointments")
    .column("timestamp")
    .execute();

  // Foreign key constraints are automatically created by Kysely when using .references()
  // in the column definitions above, so we don't need to explicitly create them here
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the appointments table and all its constraints
  await db.schema.dropTable("appointments").execute();
}
