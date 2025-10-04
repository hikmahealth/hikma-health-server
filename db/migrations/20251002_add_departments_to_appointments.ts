import { Kysely, sql } from "kysely";

/**
 * Migration: add_departments_to_appointments
 * Created at: 2025-10-03
 * Description: Add departments column to appointments table for tracking department routing.
 * We also add a flag to indicate if the appointment is a walk-in.
 * Depends on: 20250929_add_clinic_departments
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add departments column to appointments table
  await db.schema
    .alterTable("appointments")
    .addColumn("departments", "jsonb", (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    // indicates whether the appointment is a walk-in or not.
    // appointments that are not walk-ins are given priority when the time for the appointment has reached.
    .addColumn("is_walk_in", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();

  /**
   * departments data looks like this:
   * {
     id: string (department ID),
     name: string (department name),
     seen_at: string | null (ISO timestamp) defaults to null,
     seen_by: string | null (user ID) defaults to null,
     status: 'pending' | 'in_progress' | 'completed' default to 'pending'
   }
   */

  // Create GIN index on the departments column for efficient JSONB queries
  // This is for efficient queries like departments @> '[{"id": "some-department-id"}]'
  await sql`
    CREATE INDEX idx_appointments_departments_gin
    ON appointments
    USING GIN (departments)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the indexes first
  await sql`DROP INDEX IF EXISTS idx_appointments_departments_gin`.execute(db);

  // Drop the departments column
  await db.schema
    .alterTable("appointments")
    .dropColumn("departments")
    .dropColumn("is_walk_in")
    .execute();
}
