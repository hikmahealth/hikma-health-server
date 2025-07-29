import { Kysely, sql } from "kysely";

/**
 * Migration: create_resources_table
 * Created at: 2025-03-20
 * Description: Create resources table
 * Depends on: 20250313_create_server_variables_table
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create resources table
  await db.schema
    .createTable("resources")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("description", "text")
    .addColumn("store", "varchar(42)", (col) => col.notNull())
    .addColumn("store_version", "varchar(42)", (col) => col.notNull())
    .addColumn("uri", "text", (col) => col.notNull())
    .addColumn("hash", "varchar(512)")
    .addColumn("mimetype", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`)
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`)
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  // Create unique index on store and uri
  await db.schema
    .createIndex("unique_resource_ix")
    .on("resources")
    .columns(["store", "uri"])
    .unique()
    .execute();

  // Create index on store
  await db.schema
    .createIndex("store_type_ix")
    .on("resources")
    .column("store")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes first
  await db.schema.dropIndex("store_type_ix").execute();

  await db.schema.dropIndex("unique_resource_ix").execute();

  // Drop the table
  await db.schema.dropTable("resources").execute();
}
