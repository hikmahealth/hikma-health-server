import { Option } from "effect";
import type {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
  JSONColumnType,
} from "kysely";
import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
import { sql } from "kysely";
import { safeJSONParse, toSafeDateString } from "@/lib/utils";

namespace PatientAdditionalAttribute {
  export type T = {
    id: string;
    patient_id: string;
    attribute_id: string;
    attribute: string;
    number_value: Option.Option<number>;
    string_value: Option.Option<string>;
    date_value: Option.Option<Date>;
    boolean_value: Option.Option<boolean>;
    metadata: Record<string, unknown>;
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
    attribute_id: string;
    attribute: string;
    number_value: number | null;
    string_value: string | null;
    date_value: Date | null;
    boolean_value: boolean | null;
    metadata: Record<string, unknown>;
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
    export const ALWAYS_PUSH_TO_MOBILE = false;
    export const name = "patient_additional_attributes";
    export const mobileName = "patient_additional_attributes";
    export const columns = {
      id: "id",
      patient_id: "patient_id",
      attribute_id: "attribute_id",
      attribute: "attribute",
      number_value: "number_value",
      string_value: "string_value",
      date_value: "date_value",
      boolean_value: "boolean_value",
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
      attribute_id: string;
      attribute: string;
      number_value: number | null;
      string_value: string | null;
      date_value: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      boolean_value: boolean | null;
      metadata: JSONColumnType<Record<string, unknown>>;
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

    export type PatientAdditionalAttributes = Selectable<T>;
    export type NewPatientAdditionalAttributes = Insertable<T>;
    export type PatientAdditionalAttributesUpdate = Updateable<T>;
  }

  export namespace API {
    /**
     * Upsert a patient additional attribute
     */
    export const upsert = serverOnly(
      async (attribute: PatientAdditionalAttribute.EncodedT) => {
        return await db
          .insertInto(PatientAdditionalAttribute.Table.name)
          .values({
            id: attribute.id,
            patient_id: attribute.patient_id,
            attribute_id: attribute.attribute_id,
            attribute: attribute.attribute,
            number_value: attribute.number_value || null,
            string_value: attribute.string_value || null,
            date_value: attribute.date_value
              ? sql`${toSafeDateString(
                  attribute.date_value,
                )}::timestamp with time zone`
              : null,
            boolean_value: attribute.boolean_value || null,
            metadata: sql`${JSON.stringify(
              safeJSONParse(attribute.metadata, {}),
            )}::jsonb`,
            is_deleted: attribute.is_deleted,
            created_at: sql`${toSafeDateString(
              attribute.created_at,
            )}::timestamp with time zone`,
            updated_at: sql`${toSafeDateString(
              attribute.updated_at,
            )}::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
            server_created_at: sql`now()::timestamp with time zone`,
            deleted_at: null,
          })
          .onConflict((oc) =>
            oc.columns(["patient_id", "attribute_id"]).doUpdateSet({
              patient_id: (eb) => eb.ref("excluded.patient_id"),
              attribute_id: (eb) => eb.ref("excluded.attribute_id"),
              attribute: (eb) => eb.ref("excluded.attribute"),
              number_value: (eb) => eb.ref("excluded.number_value"),
              string_value: (eb) => eb.ref("excluded.string_value"),
              date_value: (eb) => eb.ref("excluded.date_value"),
              boolean_value: (eb) => eb.ref("excluded.boolean_value"),
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
     * Soft Delete a patient additional attribute
     * @param id - The id of the patient additional attribute to delete
     */
    export const softDelete = serverOnly(async (id: string) => {
      await db
        .updateTable(PatientAdditionalAttribute.Table.name)
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
    export const upsertFromDelta = serverOnly(
      async (delta: PatientAdditionalAttribute.EncodedT) => {
        return API.upsert(delta);
      },
    );

    export const deleteFromDelta = serverOnly(async (id: string) => {
      return API.softDelete(id);
    });
  }
}

export default PatientAdditionalAttribute;
