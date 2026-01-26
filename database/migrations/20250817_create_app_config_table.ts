import { Kysely, sql } from "kysely";

/**
 * Migration: create_app_config_table
 * Created at: 2025-08-17
 * Description: Create app_config table for application configuration storage
 * Depends on: 20250817_add_primary_clinic_to_patients
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create app_config table
  await db.schema
    .createTable("app_config")
    .addColumn("namespace", "varchar(128)", (col) => col.notNull())
    .addColumn("key", "varchar(128)", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.defaultTo(""))
    .addColumn("data_type", "varchar(32)", (col) =>
      col.notNull().defaultTo("string"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("last_modified_by", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("display_name", "varchar(255)")
    .execute();

  // Create composite primary key on namespace and key
  await sql`
    ALTER TABLE app_config
    ADD CONSTRAINT app_config_pkey
    PRIMARY KEY (namespace, key);
  `.execute(db);

  // Create index on namespace for faster lookups
  await db.schema
    .createIndex("idx_app_config_namespace")
    .on("app_config")
    .column("namespace")
    .execute();

  // Create index on data_type for filtering by type
  await db.schema
    .createIndex("idx_app_config_data_type")
    .on("app_config")
    .column("data_type")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes first
  await db.schema.dropIndex("idx_app_config_data_type").execute();
  await db.schema.dropIndex("idx_app_config_namespace").execute();

  // Drop the primary key constraint
  await sql`
    ALTER TABLE app_config
    DROP CONSTRAINT app_config_pkey;
  `.execute(db);

  // Drop the table
  await db.schema.dropTable("app_config").execute();
}
