import { Kysely, sql } from "kysely";

/**
 * Migration: 20251017_add_prescription_items_sync_fields
 * Created at: 2025-10-17
 * Description: Add metadata, and sync relevant fields for prescription items.
 * Depends on: 20251011_prescriptions_and_inventory_support
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("prescription_items")
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("prescription_items")
    .dropColumn("recorded_by_user_id")
    .dropColumn("metadata")
    .dropColumn("is_deleted")
    .dropColumn("created_at")
    .dropColumn("updated_at")
    .dropColumn("last_modified")
    .dropColumn("server_created_at")
    .dropColumn("deleted_at")
    .execute();
}
