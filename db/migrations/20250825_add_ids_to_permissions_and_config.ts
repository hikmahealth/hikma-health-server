import { Kysely, sql } from "kysely";
import { v1 as uuidv1 } from "uuid";

/**
 * Migration: add_ids_to_permissions_and_config
 * Created at: 2025-08-25
 * Description: Add ID columns to user_clinic_permissions and app_config tables to better support sync down to watermelondb
 * Depends on: 20250817_patient_history_support
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add ID column to user_clinic_permissions table
  await db.schema
    .alterTable("user_clinic_permissions")
    .addColumn("id", "uuid", (col) => col.notNull().defaultTo(uuidv1()))
    .execute();

  // Add ID column to app_config table
  await db.schema
    .alterTable("app_config")
    .addColumn("id", "uuid", (col) => col.notNull().defaultTo(uuidv1()))
    .execute();

  // Create unique indexes for the new ID columns
  await db.schema
    .createIndex("idx_user_clinic_permissions_id")
    .on("user_clinic_permissions")
    .column("id")
    .unique()
    .execute();

  await db.schema
    .createIndex("idx_app_config_id")
    .on("app_config")
    .column("id")
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes first
  await db.schema.dropIndex("idx_app_config_id").execute();
  await db.schema.dropIndex("idx_user_clinic_permissions_id").execute();

  // Drop ID columns
  await db.schema.alterTable("app_config").dropColumn("id").execute();

  await db.schema
    .alterTable("user_clinic_permissions")
    .dropColumn("id")
    .execute();
}
