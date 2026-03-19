import { Kysely, sql } from "kysely";

/**
 * Migration: create_event_logs
 * Created at: 2026-02-01
 * Description: Create event_logs table for immutable audit logging of system events.
 *              This table tracks all significant events that occur in the system,
 *              providing an audit trail for security, debugging, and compliance purposes.
 * Depends on: 20251020_add_batch_info_and_dispensing_triggers
 */

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Create event_logs table
  //    id has no default — always provided by the application as UUIDv7
  await db.schema
    .createTable("event_logs")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("transaction_id", "uuid", (col) => col.notNull())
    .addColumn("action_type", "text", (col) => col.notNull())
    .addColumn("table_name", "text", (col) => col.notNull())
    .addColumn("row_id", "text", (col) => col.notNull())
    .addColumn("changes", "jsonb", (col) => col.notNull())
    .addColumn("device_id", "text", (col) => col.notNull())
    .addColumn("app_id", "text", (col) => col.notNull())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("ip_address", sql`inet`)
    .addColumn("hash", "text", (col) => col.notNull())
    .addColumn("hash_verified", "boolean", (col) => col.defaultTo(false))
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
    .addColumn("deleted_at", "timestamptz")
    .execute();

  // 2. Indexes
  await db.schema
    .createIndex("idx_event_logs_transaction_id")
    .on("event_logs")
    .column("transaction_id")
    .execute();

  await db.schema
    .createIndex("idx_event_logs_table_row")
    .on("event_logs")
    .columns(["table_name", "row_id"])
    .execute();

  await db.schema
    .createIndex("idx_event_logs_user_id")
    .on("event_logs")
    .columns(["user_id", "created_at"])
    .execute();

  await db.schema
    .createIndex("idx_event_logs_device_id")
    .on("event_logs")
    .column("device_id")
    .execute();

  await db.schema
    .createIndex("idx_event_logs_action_type")
    .on("event_logs")
    .column("action_type")
    .execute();

  await db.schema
    .createIndex("idx_event_logs_hash_verified")
    .on("event_logs")
    .column("hash_verified")
    .execute();

  // Index for time-range queries (archival, recent events, etc.)
  await db.schema
    .createIndex("idx_event_logs_created_at")
    .on("event_logs")
    .column("created_at")
    .execute();

  // 3. Immutability triggers
  //    Allows updates ONLY to hash_verified and sync columns
  //    Blocks changes to core audit fields and all deletes
  await sql`
     CREATE OR REPLACE FUNCTION prevent_event_log_mutation()
     RETURNS TRIGGER AS $$
     BEGIN
       IF TG_OP = 'UPDATE' THEN
         IF (
           NEW.id                = OLD.id AND
           NEW.transaction_id    = OLD.transaction_id AND
           NEW.action_type       = OLD.action_type AND
           NEW.table_name        = OLD.table_name AND
           NEW.row_id            = OLD.row_id AND
           NEW.changes           = OLD.changes AND
           NEW.device_id         = OLD.device_id AND
           NEW.app_id            = OLD.app_id AND
           NEW.user_id           = OLD.user_id AND
           NEW.hash              = OLD.hash AND
           NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address AND
           NEW.created_at        = OLD.created_at
         ) THEN
           RETURN NEW;
         END IF;
       END IF;

       RAISE EXCEPTION 'event_logs is append-only: % operations are not permitted', TG_OP;
       RETURN NULL;
     END;
     $$ LANGUAGE plpgsql
   `.execute(db);

  await sql`
     CREATE TRIGGER trg_event_logs_no_update
       BEFORE UPDATE ON event_logs
       FOR EACH ROW
       EXECUTE FUNCTION prevent_event_log_mutation()
   `.execute(db);

  await sql`
     CREATE TRIGGER trg_event_logs_no_delete
       BEFORE DELETE ON event_logs
       FOR EACH ROW
       EXECUTE FUNCTION prevent_event_log_mutation()
   `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS trg_event_logs_no_update ON event_logs`.execute(
    db,
  );
  await sql`DROP TRIGGER IF EXISTS trg_event_logs_no_delete ON event_logs`.execute(
    db,
  );
  await sql`DROP FUNCTION IF EXISTS prevent_event_log_mutation()`.execute(db);

  await db.schema.dropTable("event_logs").execute();
}
