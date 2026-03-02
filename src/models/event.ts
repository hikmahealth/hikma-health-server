import db from "@/db";
import {
  isValidUUID,
  safeJSONParse,
  safeStringify,
  toSafeDateString,
} from "@/lib/utils";
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
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { v1 as uuidV1 } from "uuid";
import Visit from "./visit";
import Patient from "./patient";

namespace Event {
  export type T = {
    id: string;
    patient_id: string;
    visit_id: Option.Option<string>;
    form_id: Option.Option<string>;
    event_type: Option.Option<string>;
    form_data: Array<Record<string, any>>;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Option.Option<Date>;
    recorded_by_user_id: Option.Option<string>;
  };

  // Hacked together. Must be converted into a schema.
  export type EncodedT = {
    id: string;
    patient_id: string;
    visit_id: string | null;
    form_id: string | null;
    event_type: string | null;
    form_data: Array<Record<string, any>>;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Date | null;
    recorded_by_user_id: string | null;
  };

  export namespace Table {
    export const name = "events";

    export const mobileName = "events";

    export const columns = {
      id: "id",
      patient_id: "patient_id",
      visit_id: "visit_id",
      form_id: "form_id",
      event_type: "event_type",
      form_data: "form_data",
      metadata: "metadata",
      is_deleted: "is_deleted",
      created_at: "created_at",
      updated_at: "updated_at",
      last_modified: "last_modified",
      server_created_at: "server_created_at",
      deleted_at: "deleted_at",
      recorded_by_user_id: "recorded_by_user_id",
    };

    export interface T {
      id: string;
      patient_id: string;
      visit_id: string | null;
      form_id: string | null;
      event_type: string | null;
      form_data: JSONColumnType<Array<Record<string, any>>>;
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
      recorded_by_user_id: string | null;
    }

    export type Events = Selectable<T>;
    export type NewEvents = Insertable<T>;
    export type EventsUpdate = Updateable<T>;
  }

  export namespace API {
    // FIXME: Events should only be created if the visit_id is present and the visit exists. Update!
    export const save = createServerOnlyFn(
      async (id: string | null, event: Event.EncodedT) => {
        // if the id is null, we are creating a new event. If the ID is present, then we are updating an existing event.
        // Eitherway we always do an upsert
        try {
          let visitId = event.visit_id;
          let visitExists = false;

          if (
            typeof event.visit_id === "string" &&
            isValidUUID(event.visit_id)
          ) {
            const visit = await Visit.API.findById(event.visit_id);
            if (visit) {
              visitExists = true;
            } else {
              visitExists = false;
              console.error("Visit not found");
            }
          }

          if (!visitExists) {
            // we need to get a clinic, its user and create a visit. we do this by getting user and extracting that information from there
            const user = await db
              .selectFrom("users")
              .select(["clinic_id", "id", "name"])
              .limit(1)
              .executeTakeFirst();
            if (!user) {
              console.error("User not found");
              return;
            }
            const insertVisitId =
              typeof visitId === "string" && isValidUUID(visitId)
                ? visitId
                : uuidV1();
            let res = await db
              .insertInto(Visit.Table.name)
              .values({
                id: insertVisitId,
                patient_id: event.patient_id,
                clinic_id: user.clinic_id || "",
                provider_id: user.id,
                provider_name: user.name,
                check_in_timestamp: event.created_at
                  ? sql`${toSafeDateString(event.created_at)}::timestamp with time zone`
                  : null,
                metadata: sql`${{
                  artificially_created: true,
                  created_from: "server_event_creation",
                  original_event_id: event.id,
                }}::jsonb`,
                is_deleted: false,
                created_at: sql`now()::timestamp with time zone`,
                updated_at: sql`now()::timestamp with time zone`,
                last_modified: sql`now()::timestamp with time zone`,
                server_created_at: sql`now()::timestamp with time zone`,
                deleted_at: null,
              })
              .executeTakeFirst();

            visitId = insertVisitId;
          }

          return await db
            .insertInto(Event.Table.name)
            .values({
              id: id || event.id || uuidV1(),
              patient_id: event.patient_id,
              form_id: event.form_id,
              event_type: event.event_type,
              visit_id: visitId,
              form_data: sql`${JSON.stringify(
                safeJSONParse(event.form_data, []),
              )}::jsonb`,
              metadata: sql`${JSON.stringify(
                safeJSONParse(event.metadata, {}),
              )}::jsonb`,
              is_deleted: false,
              created_at: sql`${toSafeDateString(
                event.created_at,
              )}::timestamp with time zone`,
              updated_at: sql`${toSafeDateString(
                event.updated_at,
              )}::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
              server_created_at: sql`now()::timestamp with time zone`,
              deleted_at: null,
              recorded_by_user_id: event.recorded_by_user_id ?? null,
            })
            .onConflict((oc) => {
              return oc.column("id").doUpdateSet({
                patient_id: (eb) => eb.ref("excluded.patient_id"),
                visit_id: (eb) => eb.ref("excluded.visit_id"),
                form_id: (eb) => eb.ref("excluded.form_id"),
                event_type: (eb) => eb.ref("excluded.event_type"),
                form_data: (eb) => eb.ref("excluded.form_data"),
                metadata: (eb) => eb.ref("excluded.metadata"),
                is_deleted: (eb) => eb.ref("excluded.is_deleted"),
                recorded_by_user_id: (eb) =>
                  eb.ref("excluded.recorded_by_user_id"),
                updated_at: sql`now()::timestamp with time zone`,
                last_modified: sql`now()::timestamp with time zone`,
              });
            })
            .executeTakeFirst();
        } catch (error) {
          console.error("Event upsert operation failed:", {
            operation: "event_upsert",
            error: {
              message: error instanceof Error ? error.message : String(error),
              name: error instanceof Error ? error.constructor.name : "Unknown",
              stack: error instanceof Error ? error.stack : undefined,
            },
            context: {
              eventId: event.id,
            },
            timestamp: new Date().toISOString(),
          });
          throw error;
        }
      },
    );

    export const softDelete = createServerOnlyFn(async (id: string) => {
      await db
        .updateTable(Event.Table.name)
        .set({
          is_deleted: true,
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
        })
        .where("id", "=", id)
        .execute();
    });

    export const getAllByFormId = createServerOnlyFn(
      async (
        form_id: string,
        {
          limit = 50,
          offset = 0,
          includeCount = false,
        }: { limit?: number; offset?: number; includeCount?: boolean },
      ): Promise<Event.EncodedT[]> => {
        const res = await db
          .selectFrom(Table.name)
          .selectAll()
          .where("form_id", "=", form_id)
          .where("is_deleted", "=", false)
          .orderBy("created_at", "desc")
          .limit(limit)
          .offset(offset)
          .execute();
        return res as unknown as Event.EncodedT[];
      },
    );

    /**
     * Get all non-deleted events for a given visit, ordered by most recent first
     * @param visitId - The visit ID to filter by
     * @returns Array of events belonging to the visit
     */
    export const getByVisitId = createServerOnlyFn(
      async (visitId: string): Promise<Event.EncodedT[]> => {
        const res = await db
          .selectFrom(Table.name)
          .selectAll()
          .where("visit_id", "=", visitId)
          .where("is_deleted", "=", false)
          .orderBy("created_at", "desc")
          .execute();
        return res as unknown as Event.EncodedT[];
      },
    );

    /**
     * Update only the form_data and optionally metadata for an existing event
     * @param id - The event ID
     * @param formData - The new form data array
     * @param metadata - Optional updated metadata
     */
    export const updateFormData = createServerOnlyFn(
      async (
        id: string,
        formData: Array<Record<string, any>>,
        metadata?: Record<string, any>,
      ): Promise<void> => {
        const updateSet: Record<string, any> = {
          form_data: sql`${JSON.stringify(formData)}::jsonb`,
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
        };
        if (metadata !== undefined) {
          updateSet.metadata = sql`${JSON.stringify(metadata)}::jsonb`;
        }
        await db
          .updateTable(Table.name)
          .set(updateSet)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();
      },
    );

    export const getAllForExport = createServerOnlyFn(
      async (): Promise<
        (Event.EncodedT & { patient?: Partial<Patient.EncodedT> })[]
      > => {
        const query = db
          .selectFrom(Table.name)
          .selectAll()
          .where(`${Table.name}.is_deleted`, "=", false)
          .orderBy(`${Table.name}.created_at`, "desc")
          .select((eb) => [
            jsonObjectFrom(
              eb
                .selectFrom(Patient.Table.name)
                .select([
                  `${Patient.Table.name}.given_name`,
                  `${Patient.Table.name}.surname`,
                  `${Patient.Table.name}.date_of_birth`,
                  `${Patient.Table.name}.sex`,
                  `${Patient.Table.name}.phone`,
                  `${Patient.Table.name}.citizenship`,
                ])
                .whereRef(
                  `${Patient.Table.name}.id`,
                  "=",
                  `${Table.name}.patient_id`,
                ),
            ).as("patient"),
          ]);

        const res = await query.execute();
        return res as unknown as Event.EncodedT[];
      },
    );

    export const getAllWithPatientForExport = createServerOnlyFn(
      async (): Promise<(Event.EncodedT & { patient?: Patient.T })[]> => {},
    );
  }

  export namespace Sync {
    export const upsertFromDelta = createServerOnlyFn(
      async (delta: Event.EncodedT) => {
        return API.save(delta.id, delta);
      },
    );

    export const deleteFromDelta = createServerOnlyFn(async (id: string) => {
      return API.softDelete(id);
    });
  }
}

export default Event;
