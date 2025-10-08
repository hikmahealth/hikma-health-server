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
import { type Language } from "./language";
import { v1 as uuidv1 } from "uuid";
import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
import { format } from "date-fns";
import { mapObjectValues, toSafeDateString } from "@/lib/utils";
import { baseFields } from "@/data/registration-form-base-fields";

namespace PatientRegistrationForm {
  export type T = {
    id: string;
    clinic_id: Option.Option<string>;
    name: Option.Option<string>;
    fields: Field[];
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Option.Option<Date>;
  };

  export const inputTypes = [
    "number",
    "text",
    "select",
    "date",
    "boolean",
  ] as const;

  export type InputType = (typeof inputTypes)[number];

  export type Field = {
    id: string;
    position: number;
    // column name in the database
    column: string;
    label: Language.TranslationObject;
    fieldType: InputType;
    options: Language.TranslationObject[];
    required: boolean;
    baseField: boolean; // whether or not this is part of the base inputs required of all registration forms
    visible: boolean; // Whether or not it displays in the app
    deleted: boolean; // Whether or not this field has been marked as "deleted" - soft delete allows for field values to still be retrievable
    showsInSummary: boolean; // Whether or not this field is shown on the patient file
    isSearchField: boolean; // Whether or not this field can be sea
  };

  export type EncodedT = {
    id: string;
    clinic_id: string | null;
    name: string;
    fields: Field[];
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Date | null;
  };

  /**
   * Convert a database entry into a T entry
   * @param entry The database entry
   * @returns {PatientRegistrationForm.T} entry
   */
  export const fromDbEntry = (
    entry: PatientRegistrationForm.Table.PatientRegistrationForms,
  ): PatientRegistrationForm.T => {
    return {
      id: entry.id,
      clinic_id: Option.fromNullable(entry.clinic_id),
      name: Option.fromNullable(decodeURI(entry.name)),
      fields: entry.fields.map((field) => ({
        ...field,
        label: mapObjectValues(field.label, decodeURI),
        options: field.options.map((opt) => mapObjectValues(opt, decodeURI)),
        column: decodeURI(field.column),
      })),
      metadata: entry.metadata,
      is_deleted: entry.is_deleted,
      created_at: new Date(entry.created_at as unknown as Date),
      updated_at: new Date(entry.updated_at as unknown as Date),
      last_modified: new Date(entry.last_modified as unknown as Date),
      server_created_at: new Date(entry.server_created_at as unknown as Date),
      deleted_at: Option.fromNullable(
        entry.deleted_at as unknown as Date | null,
      ),
    };
  };

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = false;
    /** The name of the table in the server database */
    export const name = "patient_registration_forms";
    /** The name of the table in the mobile database */
    export const mobileName = "registration_forms";

    export const columns = {
      id: "id",
      clinic_id: "clinic_id",
      name: "name",
      fields: "fields",
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
      clinic_id: string | null;
      name: string;
      fields: JSONColumnType<Field[]>;
      metadata: JSONColumnType<Record<string, any>>;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, Date | string | undefined, string | Date>
      >;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<ColumnType<Date, string | undefined, never>>;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }

    export type PatientRegistrationForms = Selectable<T>;
    export type NewPatientRegistrationForms = Insertable<T>;
    export type PatientRegistrationFormsUpdate = Updateable<T>;
  }

  /**
   * Upsert a patient registration form
   * @param form The form to upsert
   */
  export const upsertPatientRegistrationForm = serverOnly(
    async (form: PatientRegistrationForm.EncodedT) => {
      // NOTE: it is possible for the form to not have an id (if it is a new form)
      const id = Option.match(Option.fromNullable(form.id), {
        onNone: () => uuidv1(),
        onSome: (id) => {
          if (typeof id !== "string" || id.length === 0) {
            return uuidv1();
          }
          return id;
        },
      });
      // console.log(form);
      return db
        .insertInto(Table.name)
        .values({
          id,
          clinic_id: form.clinic_id,
          name: form.name,
          // fields: form.fields,
          fields: sql`${JSON.stringify(form.fields)}::jsonb`,
          // metadata: form.metadata,
          metadata: sql`${JSON.stringify(form.metadata)}::jsonb`,
          is_deleted: false,
          created_at: sql`${toSafeDateString(
            form.created_at,
          )}::timestamp with time zone`,
          updated_at: sql`${toSafeDateString(
            form.updated_at,
          )}::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
          server_created_at: sql`now()::timestamp with time zone`,
          deleted_at: null,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            clinic_id: form.clinic_id,
            name: form.name,
            fields: sql`${JSON.stringify(form.fields)}::jsonb`,
            metadata: sql`${JSON.stringify(form.metadata)}::jsonb`,
            is_deleted: false,
            updated_at: sql`${toSafeDateString(
              form.updated_at,
            )}::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
            server_created_at: sql`now()::timestamp with time zone`,
            deleted_at: null,
          }),
        )
        .returning("id")
        .executeTakeFirstOrThrow();
    },
  );

  /**
   * Get all the patient registration forms
   * @returns {Promise<PatientRegistrationForm.T[]>} Array of patient registration forms
   */
  export const getAll = serverOnly(
    async (): Promise<PatientRegistrationForm.EncodedT[]> => {
      const result = await db.selectFrom(Table.name).selectAll().execute();

      // Merge with all base fields to support adding base fields on the fly
      return result.map((form) => {
        const existingBaseFieldIds = form.fields
          .filter((f) => f.baseField)
          .map((f) => f.id);
        const missingBaseFields = baseFields.filter(
          (f) => !existingBaseFieldIds.includes(f.id),
        );

        form.fields = [...form.fields, ...missingBaseFields];
        form.fields.sort((a, b) => a.position - b.position);
        return form;
      });
    },
  );

  /**
   * Given a registration form field and a value from a patient, return the decoded value
   * @param field The registration form field
   * @param value The value from the patient
   * @returns {unknown} The decoded value
   */
  export const renderFieldValue = (
    field: Field,
    value:
      | unknown
      | Record<
          "string_value" | "number_value" | "boolean_value" | "date_value",
          unknown | null
        >,
  ): string | number | boolean => {
    try {
      if (field.baseField) {
        switch (field.fieldType) {
          case "number":
            const num = Number(value);
            return isNaN(num) ? String(value) : num;
          case "boolean":
            return Boolean(value);
          case "date":
            const date = new Date(value as any);
            return isNaN(date.getTime())
              ? String(value)
              : format(date, "yyyy-MM-dd");
          case "text":
            return String(value);
          case "select":
            return String(value);
          default:
            return JSON.stringify(value);
        }
      } else {
        // these are the additional attributes
        const val = value as Record<
          "string_value" | "number_value" | "boolean_value" | "date_value",
          unknown | null
        >;
        switch (field.fieldType) {
          case "number":
            const num = Number(val.number_value);
            return isNaN(num) ? String(val.number_value) : num;
          case "boolean":
            return Boolean(val.boolean_value);
          case "date":
            const date = new Date(val.date_value as any);
            return isNaN(date.getTime())
              ? String(val.date_value)
              : format(date, "yyyy-MM-dd");
          case "text":
            return String(val.string_value);
          case "select":
            return String(val.string_value);
          default:
            return JSON.stringify(val);
        }
      }
    } catch (error) {
      return JSON.stringify(value);
    }
  };
}

export default PatientRegistrationForm;
