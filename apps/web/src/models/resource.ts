import { Option } from "effect";
import type {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
  JSONColumnType,
} from "kysely";

namespace Resource {
  export type T = {
    id: string;
    description: Option.Option<string>;
    store: string;
    store_version: string;
    uri: string;
    hash: Option.Option<string>;
    mimetype: string;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Option.Option<Date>;
  };

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = false;
    export const name = "resources";
    export const columns = {
      id: "id",
      description: "description",
      store: "store",
      store_version: "store_version",
      uri: "uri",
      hash: "hash",
      mimetype: "mimetype",
      created_at: "created_at",
      updated_at: "updated_at",
      last_modified: "last_modified",
      server_created_at: "server_created_at",
      deleted_at: "deleted_at",
    };

    export interface T {
      id: string;
      description: string | null;
      store: string;
      store_version: string;
      uri: string;
      hash: string | null;
      mimetype: string;
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

    export type Resources = Selectable<T>;
    export type NewResources = Insertable<T>;
    export type ResourcesUpdate = Updateable<T>;
  }
}

export default Resource;
