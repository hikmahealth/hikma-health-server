import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}

if (typeof global !== "undefined") {
  global.Buffer = Buffer;
}

import type Patient from "@/models/patient";
import type Clinic from "@/models/clinic";
import {
  Kysely,
  PostgresDialect,
  type ColumnType,
  type Generated,
  type Insertable,
  type JSONColumnType,
  type Selectable,
  type Updateable,
} from "kysely";
import type User from "@/models/user";
import type Token from "@/models/token";
import type Visit from "@/models/visit";
import type EventForm from "@/models/event-form";
import type Event from "@/models/event";
import type Resource from "@/models/resource";
import type ServerVariable from "@/models/server_variable";
import type Appointment from "@/models/appointment";
import type Prescription from "@/models/prescription";
import type PatientAdditionalAttribute from "@/models/patient-additional-attribute";
import type PatientRegistrationForms from "@/models/patient-registration-form";
import type UserClinicPermissions from "@/models/user-clinic-permissions";
import type AppConfig from "@/models/app-config";
import type PatientVital from "@/models/patient-vital";
import type PatientProblem from "@/models/patient-problem";
import type ClinicDepartment from "@/models/clinic-department";
import { Pool, type PoolConfig } from "pg";
import type { StringId, StringContent } from "@/models/string-content";
import "dotenv/config";

export type Database = {
  string_ids: StringId.Table.StringIds;
  string_content: StringContent.Table.StringContents;
  patients: Patient.Table.T;
  clinics: Clinic.Table.T;
  users: User.Table.T;
  tokens: Token.Table.T;
  visits: Visit.Table.T;
  event_forms: EventForm.Table.T;
  events: Event.Table.T;
  resources: Resource.Table.T;
  server_variables: ServerVariable.Table.T;
  patient_additional_attributes: PatientAdditionalAttribute.Table.T;
  patient_registration_forms: PatientRegistrationForms.Table.T;
  prescriptions: Prescription.Table.T;
  appointments: Appointment.Table.T;
  user_clinic_permissions: UserClinicPermissions.Table.T;
  app_config: AppConfig.Table.T;
  patient_problems: PatientProblem.Table.T;
  patient_vitals: PatientVital.Table.T;
  clinic_departments: ClinicDepartment.Table.T;
};

// Environment types
enum EnvironmentType {
  Prod = "prod",
  Staging = "stg",
  Local = "dev_local",
  Docker = "dev_docker",
}

import { getDatabaseConfig } from "./db-config";

// Application environment configuration
const appEnv = (process.env.APP_ENV as EnvironmentType) || EnvironmentType.Prod;
const isDebug = appEnv !== EnvironmentType.Prod;
const debugPort = isDebug
  ? parseInt(process.env.FLASK_DEBUG_PORT || "5000", 10)
  : undefined;

// Storage configuration
const config = {
  database: getDatabaseConfig(),
  photosStorageBucket: process.env.PHOTOS_STORAGE_BUCKET,
  exportsStorageBucket: process.env.EXPORTS_STORAGE_BUCKET || "dev-api-exports",
  localPhotoStorageDir:
    process.env.LOCAL_PHOTO_STORAGE_DIR || "/tmp/hikma_photos",
  environment: appEnv,
  debug: isDebug,
  debugPort,
};

const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      ...config.database,
    }),
  }),
});

export default db;
