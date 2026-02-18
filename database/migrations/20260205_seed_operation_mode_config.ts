/**
 * Seed the operation_mode app_config entry.
 * This controls whether the mobile app operates in offline, online, or user_choice mode.
 *
 * Depends on: 20250817_create_app_config_table
 */
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db
    .insertInto("app_config")
    .values({
      namespace: "system",
      key: "operation_mode",
      value: "user_choice",
      data_type: "string",
      display_name: "Mobile App Operation Mode",
      created_at: sql`now()`,
      updated_at: sql`now()`,
      last_modified: sql`now()`,
      last_modified_by: null,
    })
    .onConflict((oc) => oc.columns(["namespace", "key"]).doNothing())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db
    .deleteFrom("app_config")
    .where("namespace", "=", "system")
    .where("key", "=", "operation_mode")
    .execute();
}
