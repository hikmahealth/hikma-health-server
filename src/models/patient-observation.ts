import db from "@/db";
import { createServerOnlyFn } from "@tanstack/react-start";
import { Option } from "effect";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  type JSONColumnType,
  sql,
} from "kysely";
import { safeJSONParse, toSafeDateString } from "@/lib/utils";
import UserClinicPermissions from "./user-clinic-permissions";
import Patient from "./patient";

namespace PatientObservation {
  export type T = {
    id: string;
    patient_id: string;
    visit_id: Option.Option<string>;
    timestamp: Date;
    observation_code_system: Option.Option<string>;
    observation_code: string;
    observation_label: Option.Option<string>;
    value_string: Option.Option<string>;
    value_numeric: Option.Option<number>;
    value_boolean: Option.Option<boolean>;
    value_datetime: Option.Option<Date>;
    value_code: Option.Option<string>;
    value_unit: Option.Option<string>;
    recorded_by_user_id: Option.Option<string>;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Option.Option<Date>;
  };

  export type EncodedT = {
    id: string;
    patient_id: string;
    visit_id: string | null;
    timestamp: Date;
    observation_code_system: string | null;
    observation_code: string;
    observation_label: string | null;
    value_string: string | null;
    value_numeric: number | null;
    value_boolean: boolean | null;
    value_datetime: Date | null;
    value_code: string | null;
    value_unit: string | null;
    recorded_by_user_id: string | null;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Date | null;
  };

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = true;
    export const name = "patient_observations";
    /** The name of the table in the mobile database */
    export const mobileName = "patient_observations";
    export const columns = {
      id: "id",
      patient_id: "patient_id",
      visit_id: "visit_id",
      timestamp: "timestamp",
      observation_code_system: "observation_code_system",
      observation_code: "observation_code",
      observation_label: "observation_label",
      value_string: "value_string",
      value_numeric: "value_numeric",
      value_boolean: "value_boolean",
      value_datetime: "value_datetime",
      value_code: "value_code",
      value_unit: "value_unit",
      recorded_by_user_id: "recorded_by_user_id",
      metadata: "metadata",
      is_deleted: "is_deleted",
      created_at: "created_at",
      updated_at: "updated_at",
      last_modified: "last_modified",
      server_created_at: "server_created_at",
      deleted_at: "deleted_at",
    };

    export interface T {
      id: string;
      patient_id: string;
      visit_id: string | null;
      timestamp: ColumnType<Date, string | undefined, string>;
      observation_code_system: string | null;
      observation_code: string;
      observation_label: string | null;
      value_string: string | null;
      value_numeric: number | null;
      value_boolean: boolean | null;
      value_datetime: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      value_code: string | null;
      value_unit: string | null;
      recorded_by_user_id: string | null;
      metadata: JSONColumnType<Record<string, any>>;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<ColumnType<Date, string | undefined, never>>;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }

    export type PatientObservations = Selectable<T>;
    export type NewPatientObservations = Insertable<T>;
    export type PatientObservationsUpdate = Updateable<T>;
  }

  export namespace API {
    export const findById = createServerOnlyFn(
      async (
        id: string,
      ): Promise<
        | {
            id: string;
            patient_id: string;
            observation_code: string;
            is_deleted: boolean;
          }
        | undefined
      > => {
        return await db
          .selectFrom(PatientObservation.Table.name)
          .where("id", "=", id)
          .select(["id", "patient_id", "observation_code", "is_deleted"])
          .executeTakeFirst();
      },
    );

    export const findByPatientId = createServerOnlyFn(
      async (
        patient_id: string,
      ): Promise<PatientObservation.Table.PatientObservations[]> => {
        return await db
          .selectFrom(PatientObservation.Table.name)
          .where("patient_id", "=", patient_id)
          .where("is_deleted", "=", false)
          .orderBy("timestamp", "desc")
          .selectAll()
          .execute();
      },
    );

    export const findByVisitId = createServerOnlyFn(
      async (
        visit_id: string,
      ): Promise<PatientObservation.Table.PatientObservations[]> => {
        return await db
          .selectFrom(PatientObservation.Table.name)
          .where("visit_id", "=", visit_id)
          .where("is_deleted", "=", false)
          .orderBy("timestamp", "desc")
          .selectAll()
          .execute();
      },
    );

    /**
     * Upsert a patient observation record
     */
    export const upsert = createServerOnlyFn(
      async (observation: PatientObservation.EncodedT) => {
        // permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "can_edit_records",
          );

        const patientClinicId =
          await Patient.API.DANGEROUSLY_GET_CLINIC_ID_BY_ID(
            observation.patient_id,
          );

        if (patientClinicId && !clinicIds.includes(patientClinicId)) {
          throw new Error("Unauthorized");
        }
        return await upsert_core(observation);
      },
    );

    /**
     * Upsert a patient observation record
     * SYNC ONLY METHOD
     */
    export const DANGEROUS_SYNC_ONLY_upsert = createServerOnlyFn(
      async (observation: PatientObservation.EncodedT) => {
        return await upsert_core(observation);
      },
    );

    /**
     * Upsert a patient observation
     * DO NOT EXPORT OR USE DIRECTLY
     */
    const upsert_core = createServerOnlyFn(
      async (observation: PatientObservation.EncodedT) => {
        return await db
          .insertInto(PatientObservation.Table.name)
          .values({
            id: observation.id,
            patient_id: observation.patient_id,
            visit_id: observation.visit_id,
            timestamp: sql`${toSafeDateString(
              observation.timestamp,
            )}::timestamp with time zone`,
            observation_code_system: observation.observation_code_system,
            observation_code: observation.observation_code,
            observation_label: observation.observation_label,
            value_string: observation.value_string,
            value_numeric: observation.value_numeric,
            value_boolean: observation.value_boolean,
            value_datetime: observation.value_datetime
              ? sql`${toSafeDateString(
                  observation.value_datetime,
                )}::timestamp with time zone`
              : null,
            value_code: observation.value_code,
            value_unit: observation.value_unit,
            recorded_by_user_id: observation.recorded_by_user_id,
            metadata: sql`${safeJSONParse(observation.metadata, {})}::jsonb`,
            is_deleted: observation.is_deleted,
            created_at: sql`${toSafeDateString(
              observation.created_at,
            )}::timestamp with time zone`,
            updated_at: sql`${toSafeDateString(
              observation.updated_at,
            )}::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
            server_created_at: sql`now()::timestamp with time zone`,
            deleted_at: observation.deleted_at
              ? sql`${toSafeDateString(
                  observation.deleted_at,
                )}::timestamp with time zone`
              : null,
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              patient_id: (eb) => eb.ref("excluded.patient_id"),
              visit_id: (eb) => eb.ref("excluded.visit_id"),
              timestamp: (eb) => eb.ref("excluded.timestamp"),
              observation_code_system: (eb) =>
                eb.ref("excluded.observation_code_system"),
              observation_code: (eb) => eb.ref("excluded.observation_code"),
              observation_label: (eb) => eb.ref("excluded.observation_label"),
              value_string: (eb) => eb.ref("excluded.value_string"),
              value_numeric: (eb) => eb.ref("excluded.value_numeric"),
              value_boolean: (eb) => eb.ref("excluded.value_boolean"),
              value_datetime: (eb) => eb.ref("excluded.value_datetime"),
              value_code: (eb) => eb.ref("excluded.value_code"),
              value_unit: (eb) => eb.ref("excluded.value_unit"),
              recorded_by_user_id: (eb) =>
                eb.ref("excluded.recorded_by_user_id"),
              metadata: (eb) => eb.ref("excluded.metadata"),
              is_deleted: (eb) => eb.ref("excluded.is_deleted"),
              updated_at: sql`now()::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
            }),
          )
          .executeTakeFirstOrThrow();
      },
    );

    /**
     * Soft Delete a patient observation
     * @param id - The id of the observation to delete
     */
    export const softDelete = createServerOnlyFn(async (id: string) => {
      return await db
        .updateTable(PatientObservation.Table.name)
        .set({
          is_deleted: true,
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
          deleted_at: sql`now()::timestamp with time zone`,
        })
        .where("id", "=", id)
        .execute();
    });

    /**
     * Get observations by patient and code
     */
    export const findByPatientAndCode = createServerOnlyFn(
      async (
        patient_id: string,
        observation_code: string,
        limit?: number,
      ): Promise<PatientObservation.Table.PatientObservations[]> => {
        let query = db
          .selectFrom(PatientObservation.Table.name)
          .where("patient_id", "=", patient_id)
          .where("observation_code", "=", observation_code)
          .where("is_deleted", "=", false)
          .orderBy("timestamp", "desc")
          .selectAll();

        if (limit) {
          query = query.limit(limit);
        }

        return await query.execute();
      },
    );

    /**
     * Get latest observation by patient and code
     */
    export const findLatestByPatientAndCode = createServerOnlyFn(
      async (
        patient_id: string,
        observation_code: string,
      ): Promise<PatientObservation.Table.PatientObservations | undefined> => {
        return await db
          .selectFrom(PatientObservation.Table.name)
          .where("patient_id", "=", patient_id)
          .where("observation_code", "=", observation_code)
          .where("is_deleted", "=", false)
          .orderBy("timestamp", "desc")
          .selectAll()
          .limit(1)
          .executeTakeFirst();
      },
    );
  }

  export namespace Sync {
    export const upsertFromDelta = createServerOnlyFn(
      async (delta: PatientObservation.EncodedT) => {
        return API.DANGEROUS_SYNC_ONLY_upsert(delta);
      },
    );

    export const deleteFromDelta = createServerOnlyFn(async (id: string) => {
      return API.softDelete(id);
    });
  }
}

export default PatientObservation;
