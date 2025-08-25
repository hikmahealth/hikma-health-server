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
    .addColumn("id", "uuid")
    .execute();

  /// Update all existing rows with a new uuid;
  await db
    .updateTable("user_clinic_permissions")
    .set({ id: uuidv1() })
    .execute();

  /// Set the id column to not null
  await db.schema
    .alterTable("user_clinic_permissions")
    .alterColumn("id", (col) => col.setNotNull())
    .execute();

  /// Set the id column to unique
  await db.schema
    .createIndex("user_clinic_permissions_id_idx")
    .on("user_clinic_permissions")
    .column("id")
    .unique()
    .execute();

  ///////////////////////////////////
  // APP CONFIG
  // Add ID column to app_config table
  await db.schema.alterTable("app_config").addColumn("id", "uuid").execute();

  /// Update all existing rows with a new uuid;
  await db.updateTable("app_config").set({ id: uuidv1() }).execute();

  /// Set the id column to not null
  await db.schema
    .alterTable("app_config")
    .alterColumn("id", (col) => col.setNotNull())
    .execute();

  /// Set the id column to unique
  await db.schema
    .createIndex("app_config_id_idx")
    .on("user_clinic_permissions")
    .column("id")
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop ID columns
  await db.schema.alterTable("app_config").dropColumn("id").execute();

  await db.schema
    .alterTable("user_clinic_permissions")
    .dropColumn("id")
    .execute();
}
