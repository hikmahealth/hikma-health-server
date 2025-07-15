import { Option } from "effect";
import type {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
  JSONColumnType,
} from "kysely";

namespace Event {
  export type T = {
    id: string;
    patient_id: string;
    visit_id: Option.Option<string>;
    form_id: Option.Option<string>;
    event_type: Option.Option<string>;
    form_data: Record<string, any>;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Option.Option<Date>;
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
      form_data: JSONColumnType<Record<string, any>>;
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
}

export default Event;
