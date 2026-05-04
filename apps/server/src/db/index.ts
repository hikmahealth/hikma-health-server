import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}

if (typeof global !== "undefined") {
  global.Buffer = Buffer;
}

import type Patient from "@/models/patient";
import type Clinic from "@/models/clinic";
import { Kysely, PostgresDialect } from "kysely";
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
import type DrugCatalogue from "@/models/drug-catalogue";
import type ClinicInventory from "@/models/clinic-inventory";
import type InventoryTransactions from "@/models/inventory-transactions";
import type DispensingRecord from "@/models/dispensing-records";
import type DrugBatches from "@/models/drug-batches";
import type PrescriptionItems from "@/models/prescription-items";
import type PatientObservation from "@/models/patient-observation";
import type EventLog from "@/models/event-logs";
import type Device from "@/models/device";
import type DevicePinCode from "@/models/device-pin-code";
import type EducationContent from "@/models/education-content";
import type Report from "@/models/report";
import { Pool } from "pg";
import type { StringId, StringContent } from "@/models/string-content";

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
  drug_catalogue: DrugCatalogue.Table.T;
  clinic_inventory: ClinicInventory.Table.T;
  inventory_transactions: InventoryTransactions.Table.T;
  drug_batches: DrugBatches.Table.T;
  prescription_items: PrescriptionItems.Table.T;
  dispensing_records: DispensingRecord.Table.T;
  patient_observations: PatientObservation.Table.T;
  event_logs: EventLog.Table.T;
  devices: Device.Table.T;
  device_pin_codes: DevicePinCode.Table.T;
  education_content: EducationContent.Table.T;
  reports: Report.Table.T;
  report_components: Report.ComponentTable.T;
};

// The table names in the database
export type TableName = keyof Database;

// Environment types
enum EnvironmentType {
  Prod = "prod",
  Staging = "stg",
  Local = "dev_local",
  Docker = "dev_docker",
}

import { type DB } from "@hikmahealth/database/types/schema/hh";
import { getDatabaseConfig } from "@hikmahealth/database/config";

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

// Pool tuning. Defaults sit modestly above pg's built-in max of 10; override
// via env when deployment scale or DB tier warrants it. Keep
// (replica_count * DB_POOL_MAX) well under the server's
// (max_connections - superuser_reserved_connections).
const DB_POOL_MAX_DEFAULT = 20;
// Hard ceiling: a typo in env (200 -> 2000) must not let one process
// monopolise the DB and DoS sibling services (mobile sync, migrations).
const DB_POOL_MAX_CEILING = 200;
// 60s leaves room for legitimately slow reports/exports while still killing
// runaway queries. Reduce per-deployment via env once p99 query latency is
// known.
const DB_STATEMENT_TIMEOUT_MS_DEFAULT = 60_000;

const parsePositiveInt = (
  raw: string | undefined,
  fallback: number,
): number => {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const poolMaxRaw = parsePositiveInt(
  process.env.DB_POOL_MAX,
  DB_POOL_MAX_DEFAULT,
);
const poolMax = Math.min(poolMaxRaw, DB_POOL_MAX_CEILING);
if (poolMaxRaw > DB_POOL_MAX_CEILING) {
  console.warn(
    `[db] DB_POOL_MAX=${poolMaxRaw} exceeds ceiling ${DB_POOL_MAX_CEILING}; clamped to prevent DB connection monopolisation`,
  );
}
const statementTimeoutMs = parsePositiveInt(
  process.env.DB_STATEMENT_TIMEOUT_MS,
  DB_STATEMENT_TIMEOUT_MS_DEFAULT,
);

// Survive Vite/TanStack-Start HMR re-evals in dev: without caching on
// globalThis, each module reload spawns a fresh Pool while the previous
// one's connections idle on the server until pg reaps them.
type PoolCache = { __hh_pg_pool__?: Pool };
const cache = globalThis as unknown as PoolCache;

const pool =
  cache.__hh_pg_pool__ ??
  (cache.__hh_pg_pool__ = new Pool({
    ...config.database,
    max: poolMax,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    application_name: "hikma-health-server",
    // Server-side guards: a stuck transaction or runaway query releases its
    // backend slot instead of holding it until a human intervenes. This is
    // what prevents `max_connections` exhaustion under partial failure.
    statement_timeout: statementTimeoutMs,
    query_timeout: statementTimeoutMs,
    idle_in_transaction_session_timeout: statementTimeoutMs,
  }));

// pg emits 'error' on idle clients (e.g., DB failover, network blip). Without
// a listener this becomes an unhandled event and takes down the Node process.
// Whitelist log fields so we never accidentally serialise query bodies, bind
// params, or connection details into log aggregation.
if (!(cache as { __hh_pg_pool_handlers__?: boolean }).__hh_pg_pool_handlers__) {
  pool.on("error", (err: Error & { code?: string }) => {
    console.error("[db] idle pg client error", {
      name: err.name,
      message: err.message,
      code: err.code,
    });
  });
  (cache as { __hh_pg_pool_handlers__?: boolean }).__hh_pg_pool_handlers__ =
    true;
}

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export { pool };
export default db;
