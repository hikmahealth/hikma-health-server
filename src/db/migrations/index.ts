import { Kysely } from "kysely";
import * as initialTables from "./20191125_initial_tables";
import * as initialUser from "./20191126_initial_user";
import * as patientExternalIdsAndAttributes from "./20240522_patient_external_ids_and_attributes";
import * as patientAttributeUuidMigration from "./20240603_patient_attribute_uuid_migration";
import * as increaseSexTextLength from "./20240821_increase_sex_text_length";
import * as addAppointmentsTable from "./20240901_add_appointments_table";
import * as addPrescriptionsTable from "./20240926_add_prescriptions_table";
import * as createServerVariablesTable from "./20250313_create_server_variables_table";
import * as createResourcesTable from "./20250320_create_resources_table";
import * as includeHealthcareProviderSegmentation from "./20250410_include_healthcare_provider_segmentation";
import * as makeResourcesSyncable from "./20250401_make_resources_syncable";
import * as restoringPatientAttributeIndicesAndPrimaryKeys from "./20240711_restoring_patient_attribute_indices_and_primary_keys";
import { alembicMigrationIds } from "../alembic-migration-mapping";

/**
 * Database migrations
 */
export const migrations = {
  // Migration name is the timestamp and name
  "20191125_initial_tables": {
    up: initialTables.up,
    down: initialTables.down,
  },
  "20191126_initial_user": {
    up: initialUser.up,
    down: initialUser.down,
  },
  "20240522_patient_external_ids_and_attributes": {
    up: patientExternalIdsAndAttributes.up,
    down: patientExternalIdsAndAttributes.down,
  },
  "20240603_patient_attribute_uuid_migration": {
    up: patientAttributeUuidMigration.up,
    down: patientAttributeUuidMigration.down,
  },
  "20240711_restoring_patient_attribute_indices_and_primary_keys": {
    up: restoringPatientAttributeIndicesAndPrimaryKeys.up,
    down: restoringPatientAttributeIndicesAndPrimaryKeys.down,
  },
  "20240821_increase_sex_text_length": {
    up: increaseSexTextLength.up,
    down: increaseSexTextLength.down,
  },
  "20240901_add_appointments_table": {
    up: addAppointmentsTable.up,
    down: addAppointmentsTable.down,
  },
  "20240926_add_prescriptions_table": {
    up: addPrescriptionsTable.up,
    down: addPrescriptionsTable.down,
  },
  "20250313_create_server_variables_table": {
    up: createServerVariablesTable.up,
    down: createServerVariablesTable.down,
  },
  "20250320_create_resources_table": {
    up: createResourcesTable.up,
    down: createResourcesTable.down,
  },
  "20250401_make_resources_syncable": {
    up: makeResourcesSyncable.up,
    down: makeResourcesSyncable.down,
  },
  "20250410_include_healthcare_provider_segmentation": {
    up: includeHealthcareProviderSegmentation.up,
    down: includeHealthcareProviderSegmentation.down,
  },
};

// TODO: Next migration - user capability based permission system.

/**
 * Helper type for the database schema
 */
export type Migration = {
  up: (db: Kysely<any>) => Promise<void>;
  down: (db: Kysely<any>) => Promise<void>;
};

/**
 * Returns all migrations that need to be run based on the latest alembic migration id
 * @param latestAlembicMigrationId
 * @returns Record of migrations to run
 */
export const getMigrations = (
  latestAlembicMigrationId?: string,
): Record<string, Migration> => {
  // If no ID is provided, return all migrations
  if (!latestAlembicMigrationId) {
    return migrations;
  }

  const latestMigrationIndex = alembicMigrationIds.findIndex(
    ([, id]) => id === latestAlembicMigrationId,
  );
  if (latestMigrationIndex === -1) {
    throw new Error(
      `Latest alembic migration id ${latestAlembicMigrationId} not found`,
    );
  }

  const ignoredMigrationIds = alembicMigrationIds
    .slice(0, latestMigrationIndex + 1)
    .map(([key, _]) => key);

  const migrationsToRun = {};

  Object.entries(migrations).forEach(([key, value]) => {
    if (!ignoredMigrationIds.includes(key)) {
      // @ts-expect-error
      migrationsToRun[key] = value;
    }
  });

  return migrationsToRun;
};
