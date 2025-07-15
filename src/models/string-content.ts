import { Option } from "effect";
import type {
  Generated,
  ColumnType,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";

export namespace StringContent {
  export type T = {
    id: string;
    language: string;
    content: string;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    is_deleted: Option.Option<boolean>;
    deleted_at: Option.Option<Date>;
  };
  export namespace Table {
    export interface T {
      id: string;
      language: string;
      content: string;
      updated_at: ColumnType<Date, string | undefined, string | undefined>;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<ColumnType<Date, string | undefined, never>>;
      is_deleted: Generated<boolean>;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }
    export type StringContents = Selectable<T>;
    export type NewStringContents = Insertable<T>;
    export type StringContentsUpdate = Updateable<T>;
  }
}

export namespace StringId {
  export type T = {
    id: string;
    last_modified: Date;
    server_created_at: Date;
    is_deleted: Option.Option<boolean>;
    deleted_at: Option.Option<Date>;
  };
  export namespace Table {
    export interface T {
      id: Generated<string>;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<ColumnType<Date, string | undefined, never>>;
      is_deleted: Generated<boolean>;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }
    export type StringIds = Selectable<T>;
    export type NewStringIds = Insertable<T>;
    export type StringIdsUpdate = Updateable<T>;
  }
}
