import { Kysely, sql } from "kysely";

/**
 * Migration: initial_tables
 * Created at: 2019-11-25
 * Description: Initial database schema creation
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create string_ids table
  await db.schema
    .createTable("string_ids")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create string_content table
  await db.schema
    .createTable("string_content")
    .addColumn("id", "uuid", (col) =>
      col.references("string_ids.id").onDelete("cascade"),
    )
    .addColumn("language", "varchar(5)")
    .addColumn("content", "text")
    .addColumn("updated_at", "timestamptz")
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create unique index on string_content
  await db.schema
    .createIndex("string_content_id_language_unique_idx")
    .on("string_content")
    .columns(["id", "language"])
    .unique()
    .execute();

  // Create patients table
  await db.schema
    .createTable("patients")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("given_name", "text")
    .addColumn("surname", "text")
    .addColumn("date_of_birth", "date")
    .addColumn("citizenship", "text")
    .addColumn("hometown", "text")
    .addColumn("phone", "text")
    .addColumn("sex", "varchar(8)")
    .addColumn("camp", "varchar(50)")
    .addColumn("additional_data", "jsonb", (col) =>
      col.notNull().defaultTo("{}"),
    )
    .addColumn("image_timestamp", "timestamptz")
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("photo_url", "text")
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create clinics table
  await db.schema
    .createTable("clinics")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("name", "text")
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create users table
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("hashed_password", "text", (col) => col.notNull())
    .addColumn("instance_url", "text")
    .addColumn("clinic_id", "uuid", (col) =>
      col.references("clinics.id").onDelete("cascade"),
    )
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create unique index on users.email
  await db.schema
    .createIndex("users_email_unique_idx")
    .on("users")
    .column("email")
    .unique()
    .execute();

  // Create tokens table
  await db.schema
    .createTable("tokens")
    .addColumn("user_id", "uuid", (col) => col.references("users.id"))
    .addColumn("token", "text", (col) => col.notNull())
    .addColumn("expiry", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now() + INTERVAL '60 minutes'`),
    )
    .execute();

  // Create index on tokens.token
  await db.schema
    .createIndex("tokens_token_idx")
    .on("tokens")
    .column("token")
    .execute();

  // Create visits table
  await db.schema
    .createTable("visits")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("patient_id", "uuid", (col) =>
      col.references("patients.id").onDelete("cascade"),
    )
    .addColumn("clinic_id", "uuid", (col) =>
      col.references("clinics.id").onDelete("cascade"),
    )
    .addColumn("provider_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade"),
    )
    .addColumn("provider_name", "text")
    .addColumn("check_in_timestamp", "timestamptz")
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create event_forms table
  await db.schema
    .createTable("event_forms")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("name", "text")
    .addColumn("description", "text")
    .addColumn("language", "text", (col) => col.notNull().defaultTo("en"))
    .addColumn("is_editable", "boolean", (col) => col.defaultTo(true))
    .addColumn("is_snapshot_form", "boolean", (col) => col.defaultTo(false))
    .addColumn("form_fields", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create events table
  await db.schema
    .createTable("events")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("patient_id", "uuid", (col) =>
      col.references("patients.id").onDelete("cascade"),
    )
    .addColumn("visit_id", "uuid", (col) =>
      col.references("visits.id").onDelete("cascade").defaultTo(null),
    )
    .addColumn("form_id", "uuid", (col) =>
      col.references("event_forms.id").onDelete("cascade").defaultTo(null),
    )
    .addColumn("event_type", "text")
    .addColumn("form_data", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create patient_registration_forms table
  await db.schema
    .createTable("patient_registration_forms")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("clinic_id", "uuid", (col) => col.references("clinics.id"))
    .addColumn("name", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("fields", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`))
    .addColumn("last_modified", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create get_string function
  await sql`
    CREATE FUNCTION get_string(uuid, text) RETURNS text
    AS 'SELECT content FROM string_content WHERE id = $1 AND language = $2;'
    LANGUAGE SQL IMMUTABLE RETURNS NULL ON NULL INPUT;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop function
  await sql`DROP FUNCTION IF EXISTS get_string(uuid, text);`.execute(db);

  // Drop tables in reverse order to avoid foreign key constraints
  await db.schema.dropTable("patient_registration_forms").execute();
  await db.schema.dropTable("events").execute();
  await db.schema.dropTable("event_forms").execute();
  await db.schema.dropTable("tokens").execute();
  await db.schema.dropTable("visits").execute();
  await db.schema.dropTable("users").execute();
  await db.schema.dropTable("clinics").execute();
  await db.schema.dropTable("patients").execute();
  await db.schema.dropTable("string_content").execute();
  await db.schema.dropTable("string_ids").execute();
}
