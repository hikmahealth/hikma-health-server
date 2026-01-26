import { Kysely, sql } from "kysely";

/**
 * Migration: make_resources_syncable
 * Created at: 2025-04-01
 * Description: Add is_deleted column to resources table
 * Depends on: 20250320_create_resources_table
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("resources")
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("resources").dropColumn("is_deleted").execute();
}
