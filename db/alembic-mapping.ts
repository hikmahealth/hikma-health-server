/**
 * Mappings to original alembic migrations by their ids
 *
 * Last update: 2025-07-23
 *
 * ⚠️ CRITICAL: NEVER MODIFY THIS FILE ⚠️
 * This mapping is used exclusively for the one-time migration from alembic to kysely.
 * Any changes to this file could break the migration process and database integrity.
 */
const alembicMigrationIds = [
  ["20191125_initial_tables", "47dc360e825a"],
  ["20191126_initial_user", "657ba64ed784"],
  ["20240522_patient_external_ids_and_attributes", "602ce80e2a7b"],
  ["20240603_patient_attribute_uuid_migration", "a93b05fad7db"],
  [
    "20240711_restoring_patient_attribute_indices_and_primary_keys",
    "19c8d4aed7fa",
  ],
  ["20240821_increase_sex_text_length", "0fa5767e5e64"],
  ["20240901_add_appointments_table", "80e8c595e01e"],
  ["20240926_add_prescriptions_table", "db77872add9f"],
  ["20250313_create_server_variables_table", "90b1fbe863b7"],
  ["20250320_create_resources_table", "fbcd98789c00"],
  ["20250401_make_resources_syncable", "86ebf93a362c"],
  ["20250410_include_healthcare_provider_segmentation", "18edc29dd7fd"],
] as Array<[string, string]>;

export { alembicMigrationIds };
