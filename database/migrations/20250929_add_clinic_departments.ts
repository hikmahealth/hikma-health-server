import { Kysely, sql } from "kysely";

/**
 * Migration: add_clinic_departments
 * Created at: 2025-09-29
 * Description: Add departments table to support organizational structure within clinics
 * Depends on: 20250825_add_ids_to_permissions_and_config
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create departments table
  await db.schema
    .createTable("clinic_departments")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("clinic_id", "uuid", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("code", "text") // Short code like "CARDIO", "PEDS", "ER", "ICU", "OPD", "LAB"
    .addColumn("description", "text")
    .addColumn("status", "text", (col) => col.defaultTo("active")) // active, inactive, maintenance

    // Core capabilities as booleans
    .addColumn("can_dispense_medications", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn("can_perform_labs", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn("can_perform_imaging", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )

    // Future flexibility - jsonb on server, text on SQLite client
    .addColumn("additional_capabilities", "jsonb", (col) =>
      col.defaultTo(sql`'[]'`),
    )

    // Metadata for flexible department-specific data
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))

    // Audit and soft-delete columns
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")

    // Foreign key constraint
    .addForeignKeyConstraint(
      "clinic_departments_clinic_id_fkey",
      ["clinic_id"],
      "clinics",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Index on clinic_id for performance
  await db.schema
    .createIndex("clinic_departments_clinic_id_idx")
    .on("clinic_departments")
    .column("clinic_id")
    .execute();

  // EXTRA: add an archived field to the clinic table
  await db.schema
    .alterTable("clinics")
    .addColumn("is_archived", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop index first
  await db.schema.dropIndex("clinic_departments_clinic_id_idx").execute();

  // Drop the departments table and all its constraints
  await db.schema.dropTable("clinic_departments").execute();

  // Remove the archived field from the clinic table
  await db.schema.alterTable("clinics").dropColumn("is_archived").execute();
}
