import { sql, type Kysely } from "kysely";
import { DB } from "schema/hh/types";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<DB>): Promise<void> {
  // up migration code goes here...
  // note: up migrations are mandatory. you must implement this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema
    .createTable("patient_events")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("version", "bigint", (col) => col.defaultTo(1))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("patient_id", "uuid", (col) =>
      col.notNull().references("patients.id").onDelete("no action"),
    )
    .addColumn("clinic_id", "uuid", (col) =>
      col.notNull().references("clinics.id").onDelete("no action"),
    )
    .addColumn("reference_patients_event_id", "uuid", (col) =>
      col
        .references("patient_events.id")
        .onDelete("set null")
        .onUpdate("cascade"),
    )
    .addColumn("log_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("no action"),
    )
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

  await db.schema
    .createIndex("idx_patient_events_name")
    .on("patient_events")
    .column("name")
    .execute();

  // append the column to tables that may need it
  await Promise.all([
    db.schema
      .alterTable("patient_vitals")
      .addColumn("patient_event_id", "uuid", (col) =>
        col.references("patient_events.id").onDelete("set null"),
      )
      .execute(),
    db.schema
      .alterTable("prescriptions")
      .addColumn("patient_event_id", "uuid", (col) =>
        col.references("patient_events.id").onDelete("set null"),
      )
      .execute(),
  ]);
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations

  // remove the appended columns from altered tables
  await Promise.all([
    db.schema
      .alterTable("patient_vitals")
      .dropColumn("patient_event_id")
      .execute(),
    db.schema
      .alterTable("prescriptions")
      .dropColumn("patient_event_id")
      .execute(),
  ]);

  await db.schema.dropIndex("idx_patient_events_name").execute();
  await db.schema.dropTable("patient_events").execute();
}
