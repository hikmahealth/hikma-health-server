import { Kysely, sql } from "kysely";

/**
 * Migration: add clinic_ids to event_forms
 * Created at: 2026-02-05
 * Description: Add clinic_ids JSONB column to event_forms table.
 *   Empty array [] means the form is available to all clinics (backward compatible).
 *   Non-empty array means the form is limited to those specific clinics.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("event_forms")
    .addColumn("clinic_ids", "jsonb", (col) =>
      col.defaultTo(sql`'[]'::jsonb`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("event_forms")
    .dropColumn("clinic_ids")
    .execute();
}
