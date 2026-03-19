import { Option } from "effect";
import type {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
  JSONColumnType,
} from "kysely";
import { sql } from "kysely";
import db from "@/db";
import { createServerOnlyFn } from "@tanstack/react-start";
import { v1 as uuidV1 } from "uuid";

namespace ServerVariable {
  /** Well-known server variable keys */
  export const Keys = {
    AI_DATA_ANALYSIS_API_KEY: "ai_data_analysis_api_key",
    AI_DATA_ANALYSIS_URL: "ai_data_analysis_url",
  } as const;

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

  /** Retrieve a server variable by its unique key. Returns null if not found. */
  export const get = createServerOnlyFn(
    async (key: string): Promise<Table.ServerVariables | null> => {
      const row = await db
        .selectFrom(Table.name)
        .where("key", "=", key)
        .selectAll()
        .executeTakeFirst();
      return row ?? null;
    },
  );

  /** Upsert a server variable by key. Creates if missing, updates if exists. */
  export const update = createServerOnlyFn(
    async (
      variable: Pick<Table.NewServerVariables, "key" | "value_type"> &
        Partial<
          Pick<
            Table.NewServerVariables,
            "description" | "value_data" | "value_hash"
          >
        >,
    ): Promise<string> => {
      const id = uuidV1();
      const result = await db
        .insertInto(Table.name)
        .values({
          id,
          key: variable.key,
          value_type: variable.value_type,
          description: variable.description ?? null,
          value_data: variable.value_data ?? null,
          value_hash: variable.value_hash ?? null,
        })
        .onConflict((oc) =>
          oc.column("key").doUpdateSet({
            value_type: variable.value_type,
            description: variable.description ?? null,
            value_data: variable.value_data ?? null,
            value_hash: variable.value_hash ?? null,
            updated_at: sql`now()`,
          }),
        )
        .returning("id")
        .executeTakeFirstOrThrow();

      return result.id;
    },
  );

}

export default ServerVariable;
