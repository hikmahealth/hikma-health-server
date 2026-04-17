import { sql, type Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // up migration code goes here...
  // note: up migrations are mandatory. you must implement this function.
  // For more info, see: https://kysely.dev/docs/migrations

  await db.schema
    .createTable("hh_unique")
    .addColumn("tag", "varchar")
    .addColumn("key", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_search_tag")
    .on("hh_unique")
    .column("tag")
    .using("hash")
    .nullsNotDistinct()
    .execute();

  await db.schema
    .createIndex("idx_hh_tag_key_unique_pair")
    .on("hh_unique")
    .columns(["tag", "key"])
    .nullsNotDistinct()
    .execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations

  await db.schema.dropIndex("idx_hh_tag_key_unique_pair").execute();
  await db.schema.dropIndex("idx_search_tag").execute();
  await db.schema.dropTable("hh_unique").execute();
}
