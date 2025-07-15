import { Option } from "effect";
import type {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
  JSONColumnType,
} from "kysely";

namespace ServerVariable {
  export type T = {
    id: string;
    key: string;
    description: Option.Option<string>;
    value_type: string;
    value_data: Option.Option<Uint8Array>;
    value_hash: Option.Option<string>;
    created_at: Date;
    updated_at: Date;
  };

  export namespace Table {
    export const name = "server_variables";
    export const columns = {
      id: "id",
      key: "key",
      description: "description",
      value_type: "value_type",
      value_data: "value_data",
      value_hash: "value_hash",
      created_at: "created_at",
      updated_at: "updated_at",
    };

    export interface T {
      id: string;
      key: string;
      description: string | null;
      value_type: string;
      value_data: Uint8Array | null;
      value_hash: string | null;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
    }

    export type ServerVariables = Selectable<T>;
    export type NewServerVariables = Insertable<T>;
    export type ServerVariablesUpdate = Updateable<T>;
  }
}

export default ServerVariable;
