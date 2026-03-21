import { Kysely } from "kysely";

/**
 * Migration: Add auth_provider column to users table
 * Created at: 2026-03-21
 * Description: Adds an `auth_provider` column to the users table to support
 *   multiple authentication strategies. Existing users default to 'local'
 *   (bcrypt password auth). New 'ldap' users authenticate against a
 *   configured LDAP server instead of a local hashed password.
 *
 * Depends on: 20260211_cloud_based_device_management
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("auth_provider", "varchar(50)", (col) =>
      col.notNull().defaultTo("local"),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("users").dropColumn("auth_provider").execute();
}
