import { Kysely, sql } from "kysely";

/**
 * Migration: create_server_variables_table
 * Created at: 2025-03-13
 * Description: Creating server variable table
 * Depends on: 20240926_add_prescriptions_table
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("server_variables")
    .addColumn("id", "uuid", (col) => col.primaryKey().notNull())
    .addColumn("key", "varchar(128)", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("value_type", "varchar(42)", (col) => col.notNull())
    .addColumn("value_data", "bytea")
    .addColumn("value_hash", "varchar(512)")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .execute();

  // Create unique index on key
  await db.schema
    .createIndex("unique_server_key")
    .on("server_variables")
    .column("key")
    .unique()
    .execute();

  // Create hash index on value_type
  let query = sql`CREATE INDEX server_value_hash ON server_variables USING hash (value_type);`;
  await db.executeQuery(query.compile(db));
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes first
  await db.schema.dropIndex("unique_server_key").execute();

  await db.executeQuery(sql`DROP INDEX server_value_hash;`.compile(db));

  // Drop the table
  await db.schema.dropTable("server_variables").execute();
}
