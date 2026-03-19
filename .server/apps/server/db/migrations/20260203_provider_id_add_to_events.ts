import { Kysely, sql } from "kysely";

/**
 * Migration: provider_id_add_to_events
 * Created at: 2026-02-03
 * Description: Add recorded_by_user_id column to events table to track who recorded the event
 * Depends on: 20260201_create_event_logs
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add recorded_by_user_id column to events table
  await db.schema
    .alterTable("events")
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop recorded_by_user_id column from events table
  await db.schema
    .alterTable("events")
    .dropColumn("recorded_by_user_id")
    .execute();
}
