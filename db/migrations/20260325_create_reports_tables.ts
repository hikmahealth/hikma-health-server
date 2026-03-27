import { Kysely, sql } from "kysely";

/**
 * Migration: Create reports and report_components tables
 * Created at: 2026-03-25
 * Description: Persists AI-generated reports and their visualization components.
 *   Reports are admin-dashboard-only (no mobile sync).
 *   Components are replaced on edit (no versioning).
 *
 *   time_range is a JSONB column with two variants:
 *     { "type": "Fixed", "startAt": "<iso>", "endAt": "<iso>" }
 *     { "type": "Rolling", "windowDays": <int> }
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("reports")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("time_range", "jsonb", (col) => col.notNull())
    .addColumn("layout", "jsonb", (col) =>
      col.notNull().defaultTo(sql`'{"columns":12}'::jsonb`),
    )
    .addColumn("clinic_id", "uuid", (col) =>
      col.references("clinics.id").onDelete("set null"),
    )
    .addColumn("created_by", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
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
    .createTable("report_components")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("report_id", "uuid", (col) =>
      col.notNull().references("reports.id").onDelete("cascade"),
    )
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("prql_source", "text", (col) => col.notNull())
    .addColumn("compiled_sql", "text", (col) => col.notNull())
    .addColumn("compiled_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("compiler_version", "text", (col) =>
      col.notNull().defaultTo("0.1.0"),
    )
    .addColumn("position", "jsonb", (col) =>
      col.notNull().defaultTo(sql`'{"x":0,"y":0,"w":6,"h":4}'::jsonb`),
    )
    .addColumn("display", "jsonb", (col) => col.notNull())
    .addColumn("time_range", "jsonb")
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
    .addColumn("deleted_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("idx_report_components_report_id")
    .on("report_components")
    .column("report_id")
    .execute();

  await db.schema
    .createIndex("idx_reports_clinic_id")
    .on("reports")
    .column("clinic_id")
    .execute();

  await db.schema
    .createIndex("idx_reports_created_by")
    .on("reports")
    .column("created_by")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("report_components").ifExists().execute();
  await db.schema.dropTable("reports").ifExists().execute();
}
