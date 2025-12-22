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


    const pushTableNameModelMap = ENTITIES_TO_PULL_FROM_MOBILE.reduce((acc, entity) => {
        acc[entity.Table.name] = entity;
        return acc;
    }, {} as Record<PostTableName, typeof ENTITIES_TO_PULL_FROM_MOBILE[number]>);

    export type PostTableName = typeof ENTITIES_TO_PULL_FROM_MOBILE[number]["Table"]["name"];

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
        deleted: string[]
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
            console.error(
                `MAX_HISTORY_DAYS_SYNC must be a valid positive integer, got: ${envValue}. Ignoring and using no limit.`
            );
            return null;
        }

        return days;
    };

    /**
     * Get the delta records for the last synced at time
     * TODO: if lastSyncedAt is 0, no deleted records should be returned
     * @param lastSyncedAt
     * @returns
     */
    export const getDeltaRecords = async (
        lastSyncedAt: number
    ): Promise<DBChangeSet> => {
        const result: DBChangeSet = {};

      const clientLastSyncDate = new Date(lastSyncedAt);
      const now = new Date();

      // Apply history limit if MAX_HISTORY_DAYS_SYNC is set
      const maxHistoryDays = getMaxHistoryDaysSync();
      let effectiveLastSyncDate = clientLastSyncDate;

      if (maxHistoryDays !== null) {
          const cutoffDate = new Date(now.getTime() - (maxHistoryDays * 24 * 60 * 60 * 1000));
          // Use the more recent date between client's last sync and the cutoff
          effectiveLastSyncDate = clientLastSyncDate < cutoffDate ? cutoffDate : clientLastSyncDate;
      }

      // Configuration entities that should always sync full history (exempt from MAX_HISTORY_DAYS_SYNC)
      const EXEMPT_FROM_HISTORY_LIMIT = [
          'clinics',
          'patient_registration_forms',
          'event_forms',
          'drug_catalogue',
          'clinic_departments',
          'clinic_inventory' // this should synced for just the signed in clinic??
      ];

        for (const entity of ENTITIES_TO_PUSH_TO_MOBILE) {
            // It can happen that the server table name is different from the mobile table name
            // This just ensures we do the correct mapping. Often the name is the same.
            const server_table_name = entity.Table.name;
            const mobile_table_name = entity.Table.mobileName;
            const always_push_to_mobile = entity.Table?.ALWAYS_PUSH_TO_MOBILE || false;


            // Configuration entities should always sync full history, not limited by MAX_HISTORY_DAYS_SYNC
            const isExemptFromHistoryLimit = EXEMPT_FROM_HISTORY_LIMIT.includes(mobile_table_name);

            // TODO: Implementation logic for always_push_to_mobile needs to be thought out first.
            // let lastSyncDate = always_push_to_mobile ? now : effectiveLastSyncDate;
            let lastSyncDate = isExemptFromHistoryLimit ? clientLastSyncDate : effectiveLastSyncDate;

            // Query for new records created after last sync
            const newRecords = await db
                .selectFrom(server_table_name)
                .where("server_created_at", ">", lastSyncDate)
                .where("deleted_at", "is", null)
                .where("is_deleted", "=", false)
                .selectAll()
                .execute();

            // Query for records updated since last sync (but created before)
            const updatedRecords = await db
                .selectFrom(server_table_name)
                .where("last_modified", ">", lastSyncDate)
                .where("server_created_at", "<", lastSyncDate)
                .where("deleted_at", "is", null)
                .where("is_deleted", "=", false)
                .selectAll()
                .execute();

            // Query for records deleted since last sync
            const deletedRecords = lastSyncedAt === 0 ? [] : await db
                .selectFrom(server_table_name)
                .where("deleted_at", ">", lastSyncDate)
                .where("is_deleted", "=", true)
                .select("id")
                .execute();

            const deltaData = createDeltaData(
                newRecords,
                updatedRecords,
                deletedRecords.map((record: {id: string}) => record.id)
            );

            // Add records to result
            result[mobile_table_name] = deltaData;
        }

        // TODO: Pull out these table right up there near SyncableEntity definitions as a down only list of tables.
        // Process the user clinic permissions. They dont use last modified or server created attribute
        result["user_clinic_permissions"] = {
          created:  await db
              .selectFrom("user_clinic_permissions")
              .where("created_at", ">", clientLastSyncDate)
              .selectAll()
              .execute(),
          updated: await db
              .selectFrom("user_clinic_permissions")
              .where("created_at", "<", clientLastSyncDate)
              .where("updated_at", ">", clientLastSyncDate)
              .selectAll()
              .execute(),
          deleted: [] // THERE are no deleted records. Any record that is gone, is just gone.
        }

        // Process the app config. They dont use last modified or server created attribute
        result["app_config"] = {
          created:  await db
              .selectFrom("app_config")
              .where("created_at", ">", clientLastSyncDate)
              .selectAll()
              .execute(),
          updated: await db
              .selectFrom("app_config")
              .where("created_at", "<", clientLastSyncDate)
              .where("updated_at", ">", clientLastSyncDate)
              .selectAll()
              .execute(),
          deleted: [] // THERE are no deleted records. Any record that is gone, is just gone.
        }

        return result;
    };


    /**
     * Persist the delta data from the client
     * @param entity
     * @param deltaData
     */
    export const persistClientChanges = async (data: PushRequest): Promise<void> => {
        console.log("Starting to persist client changes", data);
        // Process the delta data from the client
        for (const [tableName, newDeltaJson] of Object.entries(data) as [PostTableName, Sync.DeltaData][]) {
            console.log(`Processing table: ${tableName}`);
          if (!pushTableNameModelMap[tableName]) {
            console.log(`Table ${tableName} not found in pushTableNameModelMap - ignoring`);
            continue;
          }
            // Get the entity delta values with defaults
            const deltaData = {
                created: newDeltaJson?.created || [],
                updated: newDeltaJson?.updated || [],
                deleted: newDeltaJson?.deleted || [],
            };

            // console.log(`${tableName} - Records to create: ${deltaData.created.length}, update: ${deltaData.updated.length}, delete: ${deltaData.deleted.length}`);

            for (const record of deltaData.created.concat(deltaData.updated)) {
                // console.log(`Upserting ${tableName} record:`, record.id);
                await pushTableNameModelMap[tableName].Sync.upsertFromDelta(record as typeof pushTableNameModelMap[typeof tableName].EncodedT);
            }

            for (const id of deltaData.deleted) {
                // console.log(`Deleting ${tableName} record:`, id);
                await pushTableNameModelMap[tableName].Sync.deleteFromDelta(id);
            }
        }
        console.log("Finished persisting client changes");
    };
}

export default Sync;
