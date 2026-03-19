import { Kysely, sql } from "kysely";

/**
 * Migration: add new permission columns to user_clinic_permissions
 * Created at: 2026-02-05
 * Description: Add 6 new clinic-specific capability columns:
 *   - can_edit_other_provider_event: edit another provider's filled-in event form
 *   - can_download_patient_reports: download patient reports on mobile
 *   - can_prescribe_medications: prescribe medications
 *   - can_dispense_medications: dispense medications
 *   - can_delete_patient_visits: delete patient visits
 *   - can_delete_patient_records: delete patient records
 *
 * Depends on: 20260206_clinic_ids_add_to_event_forms
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("user_clinic_permissions")
    .addColumn("can_edit_other_provider_event", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("can_download_patient_reports", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("can_prescribe_medications", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("can_dispense_medications", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("can_delete_patient_visits", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .addColumn("can_delete_patient_records", "boolean", (col) =>
      col.defaultTo(sql`false::boolean`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("user_clinic_permissions")
    .dropColumn("can_edit_other_provider_event")
    .dropColumn("can_download_patient_reports")
    .dropColumn("can_prescribe_medications")
    .dropColumn("can_dispense_medications")
    .dropColumn("can_delete_patient_visits")
    .dropColumn("can_delete_patient_records")
    .execute();
}
