import { Option } from "effect";
import type {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
  JSONColumnType,
} from "kysely";

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

  export namespace Table {
    export const name = "visits";
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
}

export default Visit;
