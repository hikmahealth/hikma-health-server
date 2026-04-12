import Patient from "./patient";
import Event from "./event";
import Appointment from "./appointment";
import Visit from "./visit";
import Prescription from "./prescription";
// import Language from "./language";
// import User from "./user";
import Clinic from "./clinic";
import PatientAdditionalAttribute from "./patient-additional-attribute";
import db from "@/db";
import { sql } from "kysely";
import EventForm from "./event-form";
import PatientRegistrationForm from "./patient-registration-form";
// import UserClinicPermissions from "./user-clinic-permissions";
// import AppConfig from "./app-config";
import PatientVital from "./patient-vital";
import PatientProblem from "./patient-problem";
import ClinicDepartment from "./clinic-department";
import DrugCatalogue from "./drug-catalogue";
import ClinicInventory from "./clinic-inventory";
import DispensingRecord from "./dispensing-records";
import PrescriptionItem from "./prescription-items";
import { toSafeDateString } from "@/lib/utils";
import User from "./user";
import Device from "./device";
import DevicePinCode from "./device-pin-code";
import UserClinicPermissions from "./user-clinic-permissions";
import type { RequestCaller } from "@/types";
import { Logger } from "@hh/js-utils";

/** Returns true if the value looks like a raw epoch timestamp (10-13 digit numeric string or number, possibly negative for pre-1970 dates). */
export const isEpochTimestamp = (value: unknown): boolean =>
  (typeof value === "string" && /^-?\d{10,13}$/.test(value.trim())) ||
  (typeof value === "number" &&
    ((value > 1e9 && value < 1e14) || (value < -1e9 && value > -1e14)));

/** Returns true if a column name looks like a date/timestamp column. */
export const isDateColumn = (name: string): boolean =>
  name.endsWith("_at") ||
  name.endsWith("_date") ||
  name === "timestamp" ||
  name === "last_modified";

namespace Sync {
  /**
   * These entities are synced to mobile. They should not contain information that is not needed for mobile use.
   * Do not sync users.
   * When adding new entities that need to be synced to mobile, add them to ENTITIES_TO_PUSH_TO_MOBILE
   */
  const ENTITIES_TO_PUSH_TO_MOBILE = [
    Patient,
    PatientAdditionalAttribute,
    Clinic,
    Visit,
    Event,
    EventForm,
    PatientRegistrationForm,
    Appointment,
    Prescription,
    PatientVital,
    PatientProblem,
    ClinicDepartment,
    DrugCatalogue,
    ClinicInventory,
    DispensingRecord,
    PrescriptionItem,
    // Add more syncable entities here. Do not add any server defined entities here that do not track server_created_at or server_updated_at
  ];

  /**
   * These entities are synced to the local sync hub. They contain a subset of the information available in the server for the respective clinics the sync hub is allowed to store data for.
   * Syncing users is allowed.
   *
   * When adding new entities that need to be synced to the hubs, add them to ENTITIES_TO_PUSH_TO_HUB
   */
  const ENTITIES_TO_PUSH_TO_HUB = [
    ...ENTITIES_TO_PUSH_TO_MOBILE,
    User,
    Device,
    DevicePinCode,
  ];

  /**
   * These entities are synced from mobile.
   * When adding new entities that need to be synced from mobile, add them to ENTITIES_TO_PULL_FROM_MOBILE
   *
   * NOTE: Not going to sync the following from mobile, they will just be ignored
   * 1. DrugCatalogue
   * 2. ClinicInventory
   * 3. Clinic
   * 4. User
   * 5. PatientRegistrationForm
   * 6. EventForm
   */
  const ENTITIES_TO_PULL_FROM_MOBILE = [
    Patient,
    PatientAdditionalAttribute,
    Visit,
    Event,
    Appointment,
    Prescription,
    PatientVital,
    PatientProblem,
    DispensingRecord,
    PrescriptionItem,
  ];

  /**
   * These entities are accepted from sync hubs. Hubs relay data from mobile
   * devices and may also manage clinic-level configuration locally, so they
   * can push a superset of what mobile pushes.
   */
  const ENTITIES_TO_PULL_FROM_HUB = [
    ...ENTITIES_TO_PULL_FROM_MOBILE,
    ClinicDepartment,
    DrugCatalogue,
    DevicePinCode,
  ];

  const pushTableNameModelMap = ENTITIES_TO_PULL_FROM_MOBILE.reduce(
    (acc, entity) => {
      acc[entity.Table.name] = entity;
      return acc;
    },
    {} as Record<PostTableName, (typeof ENTITIES_TO_PULL_FROM_MOBILE)[number]>,
  );

  const hubPushTableNameModelMap = ENTITIES_TO_PULL_FROM_HUB.reduce(
    (acc, entity) => {
      acc[entity.Table.name] = entity;
      return acc;
    },
    {} as Record<string, (typeof ENTITIES_TO_PULL_FROM_HUB)[number]>,
  );

  export type PostTableName =
    (typeof ENTITIES_TO_PULL_FROM_MOBILE)[number]["Table"]["name"];

  // Core types for WatermelonDB sync
  type SyncableEntity = {
    getDeltaRecords(lastSyncedAt: number): DeltaData;
    applyDeltaChanges(deltaData: DeltaData, lastSyncedAt: number): void;
  };

  export type DeltaData = {
    created: Record<string, any>[];
    updated: Record<string, any>[];
    deleted: string[];
    // toDict(): { created: any[]; updated: any[]; deleted: string[] };
  };

  /**
   * Method to init a new DeltaData instance
   * @param {Record<string, any>[]} created - Array of created records
   * @param {Record<string, any>[]} updated - Array of updated records
   * @param {string[]} deleted - Array of deleted record IDs
   * @returns {DeltaData}
   */
  function createDeltaData(
    created: Record<string, any>[],
    updated: Record<string, any>[],
    deleted: string[],
  ): DeltaData {
    return {
      created,
      updated,
      deleted,
    };
  }

  // Pull endpoint types
  type PullRequest = {
    last_pulled_at: number;
    schemaVersion?: number;
    migration?: any;
  };

  type PullResponse = {
    changes: {
      [tableKey: string]: {
        created: Record<string, any>[];
        updated: Record<string, any>[];
        deleted: string[];
      };
    };
    timestamp: number;
  };

  // Push endpoint types
  export type PushRequest = {
    [tableKey in PostTableName]: {
      created: Record<string, any>[];
      updated: Record<string, any>[];
      deleted: string[];
    };
  };

  type PushResponse = {
    ok: boolean;
    timestamp: string;
  };

  type DBChangeSet = PullResponse["changes"];

  /**
   * Validates and retrieves the MAX_HISTORY_DAYS_SYNC environment variable
   * @returns The number of days to limit history sync, or null if not set
   * @throws Error if the value is present but not a valid positive number
   */
  const getMaxHistoryDaysSync = (): number | null => {
    const envValue = process.env.MAX_HISTORY_DAYS_SYNC;

    if (!envValue) {
      return null;
    }

    const days = Number(envValue);

    if (isNaN(days) || days <= 0 || !Number.isInteger(days)) {
      Logger.error(
        `MAX_HISTORY_DAYS_SYNC must be a valid positive integer, got: ${envValue}. Ignoring and using no limit.`,
      );
      return null;
    }

    return days;
  };

  // Maps server table names to their clinic column for hub scoping.
  // Tables not listed here have no direct clinic association and sync unfiltered.
  const CLINIC_COLUMN_BY_TABLE: Record<string, string> = {
    patients: "primary_clinic_id",
    visits: "clinic_id",
    appointments: "clinic_id",
    prescriptions: "pickup_clinic_id",
    clinic_departments: "clinic_id",
    clinic_inventory: "clinic_id",
    dispensing_records: "clinic_id",
    prescription_items: "clinic_id",
    patient_registration_forms: "clinic_id",
    users: "clinic_id",
    user_clinic_permissions: "clinic_id",
  };

  // Tables whose clinic association is stored as an array rather than a single column.
  const CLINIC_ARRAY_TABLES: Record<
    string,
    { column: string; type: "jsonb" | "pg_array" }
  > = {
    event_forms: { column: "clinic_ids", type: "jsonb" },
    devices: { column: "clinic_ids", type: "pg_array" },
  };

  /**
   * Applies clinic-scoped filtering to a Kysely query builder for hub pulls.
   * Returns the query unchanged when clinicIds is null (non-hub peers).
   */
  function applyClinicScope<Q>(
    query: Q,
    tableName: string,
    clinicIds: string[] | null,
  ): Q {
    if (!clinicIds || clinicIds.length === 0) return query;

    // Clinics table: filter by id directly
    if (tableName === "clinics") {
      return (query as any).where("id", "in", clinicIds);
    }

    // Simple column filter (clinic_id, primary_clinic_id, etc.)
    const clinicColumn = CLINIC_COLUMN_BY_TABLE[tableName];
    if (clinicColumn) {
      return (query as any).where(clinicColumn, "in", clinicIds);
    }

    // Array-based clinic associations
    const arrayConfig = CLINIC_ARRAY_TABLES[tableName];
    if (arrayConfig) {
      const idsLiteral = `{${clinicIds.join(",")}}`;
      if (arrayConfig.type === "jsonb") {
        // JSONB array: include records with empty/null clinic_ids (available to all clinics)
        // or those whose clinic_ids overlap with the hub's clinics via ?| operator
        return (query as any).where(
          sql`(${sql.ref(arrayConfig.column)} IS NULL OR ${sql.ref(arrayConfig.column)} = '[]'::jsonb OR ${sql.ref(arrayConfig.column)} ?| ${idsLiteral}::text[])`,
        );
      }
      // PostgreSQL native uuid[] array: use && overlap operator
      return (query as any).where(
        sql`${sql.ref(arrayConfig.column)} && ${idsLiteral}::uuid[]`,
      );
    }

    // No clinic association (e.g. patient_additional_attributes, events, drug_catalogue) — no filtering
    return query;
  }

  /**
   * Get the delta records for the last synced at time
   * TODO: if lastSyncedAt is 0, no deleted records should be returned
   * @param lastSyncedAt
   * @returns
   */
  export const getDeltaRecords = async (
    lastSyncedAt: number,
    peerType: Device.DeviceTypeT,
    caller: RequestCaller,
  ): Promise<DBChangeSet> => {
    /** Determine what gets pushed to the client based on the peer type */
    const ENTITIES_TO_PUSH_TO_CLIENT =
      peerType === "sync_hub"
        ? ENTITIES_TO_PUSH_TO_HUB
        : ENTITIES_TO_PUSH_TO_MOBILE;
    const result: DBChangeSet = {};

    // Hub peers only receive data for their assigned clinics
    const hubClinicIds: string[] | null =
      peerType === "sync_hub" && "device" in caller
        ? ((caller.device.clinic_ids as unknown as string[]) ?? null)
        : null;

    const clientLastSyncDate = new Date(lastSyncedAt);
    const now = new Date();

    // Apply history limit if MAX_HISTORY_DAYS_SYNC is set
    const maxHistoryDays = getMaxHistoryDaysSync();
    let effectiveLastSyncDate = clientLastSyncDate;

    if (maxHistoryDays !== null) {
      const cutoffDate = new Date(
        now.getTime() - maxHistoryDays * 24 * 60 * 60 * 1000,
      );
      // Use the more recent date between client's last sync and the cutoff
      effectiveLastSyncDate =
        clientLastSyncDate < cutoffDate ? cutoffDate : clientLastSyncDate;
    }

    // Configuration entities that should always sync full history (exempt from MAX_HISTORY_DAYS_SYNC)
    const EXEMPT_FROM_HISTORY_LIMIT = [
      "clinics",
      "patient_registration_forms",
      "event_forms",
      "drug_catalogue",
      "clinic_departments",
      "clinic_inventory", // this should synced for just the signed in clinic??
    ];

    for (const entity of ENTITIES_TO_PUSH_TO_CLIENT) {
      // It can happen that the server table name is different from the mobile table name
      // This just ensures we do the correct mapping. Often the name is the same.
      const server_table_name = entity.Table.name;
      const mobile_table_name = entity.Table.mobileName;
      const always_push_to_mobile =
        entity.Table?.ALWAYS_PUSH_TO_MOBILE || false;

      // Configuration entities should always sync full history, not limited by MAX_HISTORY_DAYS_SYNC
      const isExemptFromHistoryLimit =
        EXEMPT_FROM_HISTORY_LIMIT.includes(mobile_table_name);

      // TODO: Implementation logic for always_push_to_mobile needs to be thought out first.
      // let lastSyncDate = always_push_to_mobile ? now : effectiveLastSyncDate;
      let lastSyncDate = isExemptFromHistoryLimit
        ? clientLastSyncDate
        : effectiveLastSyncDate;

      // Query for new records created at or after last sync.
      // Using >= to avoid missing records created exactly at the boundary timestamp.
      const newRecords = await applyClinicScope(
        db
          .selectFrom(server_table_name)
          .where("server_created_at", ">=", lastSyncDate)
          .where("deleted_at", "is", null)
          .where("is_deleted", "=", false)
          .selectAll(),
        server_table_name,
        hubClinicIds,
      ).execute();

      // Query for records updated since last sync (but created before)
      const updatedRecords = await applyClinicScope(
        db
          .selectFrom(server_table_name)
          .where("last_modified", ">", lastSyncDate)
          .where("server_created_at", "<", lastSyncDate)
          .where("deleted_at", "is", null)
          .where("is_deleted", "=", false)
          .selectAll(),
        server_table_name,
        hubClinicIds,
      ).execute();

      // Query for records deleted since last sync
      const deletedRecords =
        lastSyncedAt === 0
          ? []
          : await applyClinicScope(
              db
                .selectFrom(server_table_name)
                .where("deleted_at", ">", lastSyncDate)
                .where("is_deleted", "=", true)
                .select("id"),
              server_table_name,
              hubClinicIds,
            ).execute();

      const deltaData = createDeltaData(
        newRecords,
        updatedRecords,
        deletedRecords.map((record: { id: string }) => record.id),
      );

      // Add records to result
      result[mobile_table_name] = deltaData;
    }

    // TODO: Pull out these table right up there near SyncableEntity definitions as a down only list of tables.
    // Process the user clinic permissions. They dont use last modified or server created attribute
    result["user_clinic_permissions"] = {
      created: await applyClinicScope(
        db
          .selectFrom("user_clinic_permissions")
          .where("created_at", ">=", clientLastSyncDate)
          .selectAll(),
        "user_clinic_permissions",
        hubClinicIds,
      ).execute(),
      updated: await applyClinicScope(
        db
          .selectFrom("user_clinic_permissions")
          .where("created_at", "<", clientLastSyncDate)
          .where("updated_at", ">", clientLastSyncDate)
          .selectAll(),
        "user_clinic_permissions",
        hubClinicIds,
      ).execute(),
      deleted: [], // THERE are no deleted records. Any record that is gone, is just gone.
    };

    // Process the app config. They dont use last modified or server created attribute
    result["app_config"] = {
      created: await db
        .selectFrom("app_config")
        .where("created_at", ">=", clientLastSyncDate)
        .selectAll()
        .execute(),
      updated: await db
        .selectFrom("app_config")
        .where("created_at", "<", clientLastSyncDate)
        .where("updated_at", ">", clientLastSyncDate)
        .selectAll()
        .execute(),
      deleted: [], // THERE are no deleted records. Any record that is gone, is just gone.
    };

    return result;
  };

  /**
   * Checks whether a record is authorized for a hub to push, based on
   * the record's clinic association and the hub's authorized clinic IDs.
   * Returns true if the table has no direct clinic column (indirectly associated).
   */
  function isRecordAuthorizedForClinic(
    record: Record<string, any>,
    tableName: string,
    authorizedClinicIds: Set<string>,
  ): boolean {
    const clinicColumn = CLINIC_COLUMN_BY_TABLE[tableName];
    if (!clinicColumn) return true;

    const recordClinicId = record[clinicColumn];
    // Null/undefined clinic — allow (e.g. patients with no primary_clinic_id yet)
    if (!recordClinicId) return true;

    return authorizedClinicIds.has(recordClinicId);
  }

  /**
   * Persist the delta data from the client.
   *
   * **Clock-skew assumption**: Each model's upsert uses a WHERE guard
   * (`excluded.updated_at > <table>.updated_at`) to reject stale records.
   * `excluded.updated_at` is the *client-provided* timestamp from the INSERT
   * VALUES clause, while the stored value may be either client-provided or
   * server-set (`now()`) depending on the model. This means a client whose
   * clock is significantly behind the server could have legitimate updates
   * silently dropped. Callers (mobile apps / hubs) should keep their clocks
   * reasonably synchronised (e.g. via NTP).
   *
   * @param entity
   * @param deltaData
   */
  export const persistClientChanges = async (
    data: PushRequest,
    peerType: Device.DeviceTypeT,
    caller: RequestCaller,
  ): Promise<void> => {
    // Hub peers can push a wider set of entities than mobile devices
    const isHub = peerType === "sync_hub";
    const entitiesToPull = isHub
      ? ENTITIES_TO_PULL_FROM_HUB
      : ENTITIES_TO_PULL_FROM_MOBILE;
    const tableModelMap: Record<
      string,
      (typeof ENTITIES_TO_PULL_FROM_HUB)[number]
    > = isHub ? hubPushTableNameModelMap : pushTableNameModelMap;

    // Hub authorization: build a set of allowed clinic IDs for fast lookups
    const hubAuthorizedClinicIds: Set<string> | null =
      isHub && "device" in caller
        ? new Set((caller.device.clinic_ids as unknown as string[]) ?? [])
        : null;

    // Process the delta data from the client.
    // Iterate over the entity list (not Object.entries) to guarantee
    // dependency order: patients → patient_additional_attributes → visits → events → …
    for (const entity of entitiesToPull) {
      const tableName = entity.Table.name;
      const newDeltaJson = (data as Record<string, DeltaData>)[tableName];
      if (!newDeltaJson) {
        continue;
      }
      Logger.log(`Processing table: ${tableName}`);
      // Get the entity delta values with defaults
      const deltaData = {
        created: newDeltaJson?.created || [],
        updated: newDeltaJson?.updated || [],
        deleted: newDeltaJson?.deleted || [],
      };

      const knownColumns = new Set(
        Object.keys(tableModelMap[tableName].Table.columns),
      );

      for (const record of deltaData.created.concat(deltaData.updated)) {
        // Strip unknown columns (e.g. WatermelonDB's _status, _changed) and
        // convert raw epoch timestamps to ISO strings so PostgreSQL can parse them.
        const cleaned = Object.fromEntries(
          Object.entries(record)
            .filter(([key]) => {
              if (knownColumns.has(key)) return true;
              Logger.warn(
                `[sync] Ignoring unknown column "${key}" for table "${tableName}"`,
              );
              return false;
            })
            .map(([key, value]) => {
              if (isEpochTimestamp(value)) {
                Logger.warn(
                  `[sync] Converting epoch timestamp in "${tableName}.${key}": ${value}`,
                );
                return [key, toSafeDateString(value)];
              }
              // Mobile clients may send 0/"0" for empty date fields — coerce to null
              if ((value === 0 || value === "0") && isDateColumn(key)) {
                Logger.warn(
                  `[sync] Converting zero date to null in "${tableName}.${key}"`,
                );
                return [key, null];
              }
              return [key, value];
            }),
        );

        // Hub authorization: reject records targeting clinics the hub isn't assigned to
        if (
          hubAuthorizedClinicIds &&
          !isRecordAuthorizedForClinic(
            cleaned,
            tableName,
            hubAuthorizedClinicIds,
          )
        ) {
          const clinicColumn = CLINIC_COLUMN_BY_TABLE[tableName];
          Logger.warn(
            `[sync] Hub not authorized to push "${tableName}" record ${cleaned.id} — ` +
              `clinic ${cleaned[clinicColumn!]} not in hub's authorized clinics`,
          );
          continue;
        }

        await tableModelMap[tableName].Sync.upsertFromDelta(
          cleaned as any,
          caller,
        );
      }

      for (const id of deltaData.deleted) {
        await tableModelMap[tableName].Sync.deleteFromDelta(id);
      }
    }

    // Warn about any tables the client sent that we don't recognize
    const knownTableNames = new Set(entitiesToPull.map((e) => e.Table.name));
    for (const tableName of Object.keys(data)) {
      if (!knownTableNames.has(tableName)) {
        Logger.warn(
          `[sync] Table "${tableName}" not found in accepted entities for ${isHub ? "hub" : "mobile"} - ignoring`,
        );
      }
    }

    Logger.log("Finished persisting client changes");
  };
}

export default Sync;
