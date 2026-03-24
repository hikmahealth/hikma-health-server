import { Kysely, sql } from "kysely";

/**
 * Migration: Create education_content table
 * Created at: 2026-03-22
 * Description: Stores educational content for patients. Supports two content types:
 *   1. "tiptap" — rich text created in the portal editor (stored as TipTap JSON)
 *   2. "resource" — standalone uploaded file (PDF/image) linked via resource_id
 *
 * Depends on: 20260211_cloud_based_device_management
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("education_content")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("title", "varchar(512)", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("content_type", "varchar(32)", (col) => col.notNull())
    .addColumn("tiptap_content", "jsonb")
    .addColumn("resource_id", "uuid", (col) =>
      col.references("resources.id").onDelete("set null"),
    )
    .addColumn("status", "varchar(16)", (col) =>
      col.notNull().defaultTo("draft"),
    )
    .addColumn("visibility", "varchar(16)", (col) =>
      col.notNull().defaultTo("private"),
    )
    .addColumn("language", "varchar(8)", (col) => col.notNull().defaultTo("en"))
    .addColumn("tags", "jsonb", (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .addColumn("metadata", "jsonb", (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn("author_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("published_at", "timestamptz")
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Index for listing published public content (the most common public query)
  await db.schema
    .createIndex("idx_education_content_status_visibility")
    .on("education_content")
    .columns(["status", "visibility"])
    .execute();

  // Index for sorting published content by publication date
  await db.schema
    .createIndex("idx_education_content_published_at")
    .on("education_content")
    .column("published_at")
    .execute();

  // GIN index on tags for efficient array containment queries (https://pganalyze.com/blog/gin-index)
  await db.schema
    .createIndex("idx_education_content_tags")
    .on("education_content")
    .using("gin")
    .column("tags")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("education_content").ifExists().execute();
}
