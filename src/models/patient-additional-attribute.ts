import { Option } from "effect";
import type {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
  JSONColumnType,
} from "kysely";

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

  export namespace Table {
    export const name = "patient_additional_attributes";
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
}

export default PatientAdditionalAttribute;
