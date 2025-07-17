import { Kysely } from "kysely";
import * as initialTables from "./20191125_initial_tables";
import * as initialUser from "./20191126_initial_user";
import * as patientExternalIdsAndAttributes from "./20240522_patient_external_ids_and_attributes";
import * as patientAttributeUuidMigration from "./20240603_patient_attribute_uuid_migration";
import * as increaseSexTextLength from "./20240821_increase_sex_text_length";
import * as addAppointmentsTable from "./20240901_add_appointments_table";
import * as addPrescriptionsTable from "./20240926_add_prescriptions_table";
import * as createServerVariablesTable from "./20250313_create_server_variables_table";

// Migration object that follows the Kysely migrations format
export const migrations = {
  // Migration name is the timestamp and name
  "20191125_initial_tables": {
    up: initialTables.up,
    down: initialTables.down,
  },
  "20191125_initial_user": {
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
};

// Helper type for the database schema
export type Migration = {
  up: (db: Kysely<any>) => Promise<void>;
  down: (db: Kysely<any>) => Promise<void>;
};

// Helper function to get all migrations
export const getMigrations = (): Record<string, Migration> => migrations;
