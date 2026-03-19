import { Kysely, sql } from "kysely";

/**
 * Migration: add translations to event_forms
 * Created at: 2026-02-07
 * Description: Add translations JSONB column to event_forms table.
 *   Empty array [] means no translations exist (backward compatible).
 *   Contains FieldTranslation objects keyed by field ID.
 *
 *
 * Depends on: 20260206_new_permission_columns_add
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("event_forms")
    .addColumn("translations", "jsonb", (col) =>
      col.defaultTo(sql`'[]'::jsonb`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("event_forms")
    .dropColumn("translations")
    .execute();
}
