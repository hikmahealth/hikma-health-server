import { Kysely, sql } from "kysely";

/**
 * Migration: add user_clinic_permissions
 * Created at: 2025-08-16
 * Description: Add user clinic permissions to manage permissions at the clinic level
 * Depends on: 20250410_include_healthcare_provider_segmentation
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create user_clinic_permissions
  await db.schema
    .createTable("user_clinic_permissions")
    .addColumn("user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade"),
    )
    .addColumn("clinic_id", "uuid", (col) =>
      col.references("clinics.id").onDelete("cascade"),
    )
    .addColumn("can_register_patients", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("can_view_history", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("can_edit_records", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("can_delete_records", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("is_clinic_admin", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("created_by", "uuid", (col) => col.references("users.id"))
    .addColumn("last_modified_by", "uuid")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .execute();

  // Add indexes for common query patterns
  await db.schema
    .createIndex("idx_user_clinic_permissions_user_id")
    .on("user_clinic_permissions")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_user_clinic_permissions_clinic_id")
    .on("user_clinic_permissions")
    .column("clinic_id")
    .execute();

  // Create the primary key constraint
  await sql`
    ALTER TABLE user_clinic_permissions
    ADD CONSTRAINT user_clinic_permissions_pkey
    PRIMARY KEY (user_id, clinic_id);
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the primary key constraint
  await sql`
    ALTER TABLE user_clinic_permissions
    DROP CONSTRAINT user_clinic_permissions_pkey;
  `.execute(db);

  // Drop indexes
  await db.schema.dropIndex("idx_user_clinic_permissions_clinic_id").execute();

  await db.schema.dropIndex("idx_user_clinic_permissions_user_id").execute();

  // Drop the table
  await db.schema.dropTable("user_clinic_permissions").execute();
}
