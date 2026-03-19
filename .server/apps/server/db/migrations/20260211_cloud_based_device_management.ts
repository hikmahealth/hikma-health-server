import { Kysely, sql } from "kysely";

/**
 * Migration: Create devices table for cloud-based device management
 * Created at: 2026-02-11
 * Description: Creates a "devices" table to track and manage all devices in the
 *   Hikma Health EHR network — provider Android/iOS devices, laptops, sync hubs,
 *   servers, etc. Each device has a hashed API key for authentication, status
 *   tracking, clinic association, and hardware/software specifications.
 *
 *   Also creates a "device_pin_codes" table for remote unlock PINs. PINs are
 *   hashed server-side and synced to devices for offline unlock verification.
 *
 * Depends on: 20260207_add_translations_to_event_forms
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("devices")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("device_type", "varchar(50)", (col) => col.notNull())
    .addColumn("hardware_id", "varchar(255)")
    .addColumn("hardware_id_type", "varchar(50)")
    .addColumn("os_type", "varchar(50)")
    .addColumn("app_version", "varchar(50)")
    .addColumn("api_key_hash", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("status", "varchar(50)", (col) =>
      col.notNull().defaultTo("active"),
    )
    .addColumn("clinic_ids", sql`uuid[]`, (col) =>
      col.notNull().defaultTo(sql`'{}'::uuid[]`),
    )
    .addColumn("max_pin_attempts", "integer", (col) =>
      col.notNull().defaultTo(3),
    )
    .addColumn("failed_pin_attempts", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("last_seen_at", "timestamptz")
    .addColumn("specifications", "jsonb", (col) =>
      col.notNull().defaultTo("{}"),
    )
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

  // Index on status for filtering active/inactive devices
  await db.schema
    .createIndex("idx_devices_status")
    .on("devices")
    .column("status")
    .execute();

  // Index on device_type for filtering by category
  await db.schema
    .createIndex("idx_devices_device_type")
    .on("devices")
    .column("device_type")
    .execute();

  // Unique composite index on hardware_id + hardware_id_type to prevent duplicate physical devices
  // Partial index: only enforced when hardware_id is not null
  await sql`CREATE UNIQUE INDEX idx_devices_hardware_id ON devices (hardware_id, hardware_id_type) WHERE hardware_id IS NOT NULL`.execute(
    db,
  );

  // GIN index on clinic_ids for efficient array containment queries
  await db.schema
    .createIndex("idx_devices_clinic_ids")
    .on("devices")
    .using("gin")
    .column("clinic_ids")
    .execute();
  // ============================================
  // device_pin_codes table
  // ============================================

  await db.schema
    .createTable("device_pin_codes")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("device_id", "uuid", (col) =>
      col.notNull().references("devices.id").onDelete("cascade"),
    )
    .addColumn("pin_hash", "varchar(255)", (col) => col.notNull())
    .addColumn("label", "varchar(255)")
    .addColumn("issued_to_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("issued_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("status", "varchar(50)", (col) =>
      col.notNull().defaultTo("active"),
    )
    .addColumn("expires_at", "timestamptz")
    .addColumn("last_used_at", "timestamptz")
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

  // Index on device_id for fast lookup of PINs belonging to a device
  await db.schema
    .createIndex("idx_device_pin_codes_device_id")
    .on("device_pin_codes")
    .column("device_id")
    .execute();

  // Index on status for filtering active/revoked/expired PINs
  await db.schema
    .createIndex("idx_device_pin_codes_status")
    .on("device_pin_codes")
    .column("status")
    .execute();

  // Index on expires_at for efficient expiry queries
  await db.schema
    .createIndex("idx_device_pin_codes_expires_at")
    .on("device_pin_codes")
    .column("expires_at")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("device_pin_codes").ifExists().execute();
  await db.schema.dropTable("devices").ifExists().execute();
}
