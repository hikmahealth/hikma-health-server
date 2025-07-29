import db from "@/db";
import { isValidUUID, safeStringify } from "@/lib/utils";
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
import { v1 as uuidV1 } from "uuid";
import Visit from "./visit";

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
  };

  export namespace Table {
    export const name = "events";

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
    }

    export type Events = Selectable<T>;
    export type NewEvents = Insertable<T>;
    export type EventsUpdate = Updateable<T>;
  }

  export namespace API {
    // FIXME: Events should only be created if the visit_id is present and the visit exists. Update!
    export const save = serverOnly(
      async (id: string | null, event: Event.EncodedT) => {
        // if the id is null, we are creating a new event. If the ID is present, then we are updating an existing event.
        // Eitherway we always do an upsert

        let visitId = event.visit_id;
        let visitExists = false;

        if (typeof event.visit_id === "string" && isValidUUID(event.visit_id)) {
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
          await db
            .insertInto(Visit.Table.name)
            .values({
              id: uuidV1(),
              patient_id: event.patient_id,
              clinic_id: user.clinic_id || "",
              provider_id: user.id,
              provider_name: user.name,
              check_in_timestamp: event.created_at
                ? sql`${event.created_at}::timestamp with time zone`
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
        }

        return await db
          .insertInto(Event.Table.name)
          .values({
            id: id || event.id || uuidV1(),
            patient_id: event.patient_id,
            form_data: sql`${event.form_data}::jsonb`,
            metadata: sql`${event.metadata}::jsonb`,
            is_deleted: false,
            created_at: sql`now()::timestamp with time zone`,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
            server_created_at: sql`now()::timestamp with time zone`,
            deleted_at: null,
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
              updated_at: sql`now()::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
            });
          })
          .executeTakeFirst();
      }
    );

    export const softDelete = serverOnly(async (id: string) => {
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
  }

  export namespace Sync {
    export const upsertFromDelta = serverOnly(async (delta: Event.EncodedT) => {
      return API.save(delta.id, delta);
    });

    export const deleteFromDelta = serverOnly(async (id: string) => {
      return API.softDelete(id);
    });
  }
}

export default Event;
