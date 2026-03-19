import { Kysely, sql } from "kysely";

/**
 * Migration: include_healthcare_provider_segmentation
 * Created at: 2025-04-10
 * Description: Add clinic attributes, metadata, and address columns
 * Depends on: 20250320_create_resources_table
 * Original Alembic revision: 18edc29dd7fd
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add columns to clinics table
  await db.schema
    .alterTable("clinics")
    // services or offerings or something like
    .addColumn("attributes", sql`text[] NOT NULL DEFAULT ARRAY[]::text[]`)
    .addColumn("metadata", sql`JSONB NOT NULL DEFAULT '{}'`)
    .addColumn("address", "text")
    .execute();

  // Create hash index on attributes
  await db.schema
    .createIndex("attributes_hash_ix")
    .on("clinics")
    .expression(sql`(attributes)`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop index first
  await db.schema.dropIndex("attributes_hash_ix").execute();

  // Drop columns from clinics table
  await db.schema
    .alterTable("clinics")
    .dropColumn("attributes")
    .dropColumn("metadata")
    .dropColumn("address")
    .execute();
}
