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
};

// Environment types
enum EnvironmentType {
  Prod = "prod",
  Staging = "stg",
  Local = "dev_local",
  Docker = "dev_docker",
}

// Extract database configuration from environment variables
const getDatabaseConfig = (): Record<string, any> => {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseUrlAzure = process.env.AZURE_POSTGRESQL_CONNECTIONSTRING;
  let pgHost: string;
  let pgPort: string = process.env.DB_PORT || "5432";
  let pgDb: string;
  let pgUser: string;
  let pgPassword: string;

  if (databaseUrl) {
    // Extract connection details from DATABASE_URL
    const [dbProto, connectionParams] = databaseUrl.split("//");

    if (dbProto !== "postgresql:") {
      throw new Error(
        "Using a non postgresql database. HH only supports PostgreSQL.",
      );
    }

    const [credentials, url] = connectionParams.split("@");
    const values = url.split("/")[0].split(":");

    pgHost = values[0];
    pgPort = values.length > 1 ? values[1] : "5432";
    pgDb = url.split("/")[1];
    pgUser = credentials.split(":")[0];
    pgPassword = credentials.split(":")[1];
  } else if (databaseUrlAzure) {
    // Extract connection details from Azure connection string
    const connStrParams = Object.fromEntries(
      databaseUrlAzure.split(" ").map((pair) => {
        const [key, value] = pair.split("=");
        return [key, value];
      }),
    );

    pgUser = connStrParams.user;
    pgPassword = connStrParams.password;
    pgHost = connStrParams.host;
    pgDb = connStrParams.dbname;
  } else {
    // Use individual environment variables
    pgHost = process.env.DB_HOST!;
    pgDb = process.env.DB_NAME!;
    pgUser = process.env.DB_USER!;
    pgPassword = process.env.DB_PASSWORD!;

    if (!pgHost || !pgDb || !pgUser || !pgPassword) {
      throw new Error(
        "Missing database configuration. Please set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD environment variables.",
      );
    }
  }

  return {
    host: pgHost,
    port: parseInt(pgPort, 10),
    database: pgDb,
    user: pgUser,
    password: pgPassword,
  };
};

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
      ssl: true,
    }),
  }),
});

export default db;
