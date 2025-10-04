import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
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
import Prescription from "./prescription";
import Appointment from "./appointment";
import Event from "./event";
import { safeJSONParse, toSafeDateString } from "@/lib/utils";
import UserClinicPermissions from "./user-clinic-permissions";
import Patient from "./patient";

namespace Visit {
  export type T = {
    id: string;
    patient_id: string;
    clinic_id: string;
    provider_id: string;
    provider_name: Option.Option<string>;
    check_in_timestamp: Option.Option<Date>;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Option.Option<Date>;
  };

  // Hacked together. Must be converted into a schema.
  export type EncodedT = {
    id: string;
    patient_id: string;
    clinic_id: string;
    provider_id: string;
    provider_name: string | null;
    check_in_timestamp: Date | null;
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
    export const name = "visits";
    /** The name of the table in the mobile database */
    export const mobileName = "visits";
    export const columns = {
      id: "id",
      patient_id: "patient_id",
      clinic_id: "clinic_id",
      provider_id: "provider_id",
      provider_name: "provider_name",
      check_in_timestamp: "check_in_timestamp",
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
      clinic_id: string;
      provider_id: string;
      provider_name: string | null;
      check_in_timestamp: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
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

    export type Visits = Selectable<T>;
    export type NewVisits = Insertable<T>;
    export type VisitsUpdate = Updateable<T>;
  }

  export namespace API {
    export const findById = serverOnly(
      async (
        id: string,
      ): Promise<
        | {
            id: string;
            provider_name: string | null;
            is_deleted: boolean;
          }
        | undefined
      > => {
        return await db
          .selectFrom(Visit.Table.name)
          .where("id", "=", id)
          .select(["id", "is_deleted", "provider_name"])
          .executeTakeFirst();
      },
    );
    /**
     * Upsert a patient record without the additional patient attributes
     */
    export const upsert = serverOnly(async (visit: Visit.EncodedT) => {
      // permissions check
      const clinicIds =
        await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
          "can_edit_records",
        );

      const patientClinicId = await Patient.API.DANGEROUSLY_GET_CLINIC_ID_BY_ID(
        visit.patient_id,
      );

      if (
        patientClinicId &&
        patientClinicId !== visit.clinic_id &&
        !clinicIds.includes(patientClinicId)
      ) {
        throw new Error("Unauthorized");
      }
      return await upsert_core(visit);
    });

    /**
     * Upsert a visit record
     * SYNC ONLY METHOD
     */
    export const DANGEROUS_SYNC_ONLY_upsert = serverOnly(
      async (visit: Visit.EncodedT) => {
        return await upsert_core(visit);
      },
    );

    /**
     * Upsert a visit
     * DO NOT EXPORT OR USE DIRECTLY
     * note: experimenting with visits coming in with their own ids.
     */
    const upsert_core = serverOnly(async (visit: Visit.EncodedT) => {
      return await db
        .insertInto(Visit.Table.name)
        .values({
          id: visit.id,
          patient_id: visit.patient_id,
          clinic_id: visit.clinic_id,
          provider_id: visit.provider_id,
          provider_name: visit.provider_name,
          check_in_timestamp: visit.check_in_timestamp
            ? sql`${toSafeDateString(
                visit.check_in_timestamp,
              )}::timestamp with time zone`
            : null,
          metadata: sql`${safeJSONParse(visit.metadata, {})}::jsonb`,
          is_deleted: visit.is_deleted,
          created_at: sql`${toSafeDateString(
            visit.created_at,
          )}::timestamp with time zone`,
          updated_at: sql`${toSafeDateString(
            visit.updated_at,
          )}::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
          server_created_at: sql`now()::timestamp with time zone`,
          deleted_at: null,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            patient_id: (eb) => eb.ref("excluded.patient_id"),
            clinic_id: (eb) => eb.ref("excluded.clinic_id"),
            provider_id: (eb) => eb.ref("excluded.provider_id"),
            provider_name: (eb) => eb.ref("excluded.provider_name"),
            check_in_timestamp: (eb) => eb.ref("excluded.check_in_timestamp"),
            metadata: (eb) => eb.ref("excluded.metadata"),
            is_deleted: (eb) => eb.ref("excluded.is_deleted"),
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          }),
        )
        .executeTakeFirstOrThrow();
    });

    /**
     * Soft Delete a visit
     * @param id - The id of the visit to delete
     *
     * Deletes on visits cascade down to any prescriptoins, events, appointments, etc that are related to the visit.
     */
    export const softDelete = serverOnly(async (id: string) => {
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable(Visit.Table.name)
          .set({
            is_deleted: true,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", id)
          .execute();

        await trx
          .updateTable(Prescription.Table.name)
          .set({
            is_deleted: true,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("visit_id", "=", id)
          .execute();

        await trx
          .updateTable(Event.Table.name)
          .set({
            is_deleted: true,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("visit_id", "=", id)
          .execute();

        await trx
          .updateTable(Appointment.Table.name)
          .set({
            is_deleted: true,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("appointments.current_visit_id", "=", id)
          .execute();
      });
    });
  }

  export namespace Sync {
    export const upsertFromDelta = serverOnly(async (delta: Visit.EncodedT) => {
      return API.DANGEROUS_SYNC_ONLY_upsert(delta);
    });

    export const deleteFromDelta = serverOnly(async (id: string) => {
      return API.softDelete(id);
    });
  }
}

export default Visit;
