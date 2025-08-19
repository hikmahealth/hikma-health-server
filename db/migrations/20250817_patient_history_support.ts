import { Kysely, sql } from "kysely";

/**
 * Migration: patient_history_support
 * Created at: 2025-08-17
 * Description: Add support for patient medical history with hybrid model approach
 * Depends on: 20250817_create_app_config_table
 */
export async function up(db: Kysely<any>): Promise<void> {
  // 1. Vitals Table
  await db.schema
    .createTable("patient_vitals")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("patient_id", "uuid", (col) =>
      col.references("patients.id").onDelete("cascade").notNull(),
    )
    .addColumn("visit_id", "uuid", (col) =>
      col.references("visits.id").onDelete("set null"),
    )
    .addColumn("timestamp", "timestamptz", (col) => col.notNull())
    .addColumn("systolic_bp", "integer")
    .addColumn("diastolic_bp", "integer")
    // sitting | standing | ...
    .addColumn("bp_position", "varchar(50)")
    .addColumn("height_cm", "decimal(5, 2)")
    .addColumn("weight_kg", "decimal(5, 2)")
    .addColumn("bmi", "decimal(4, 2)")
    .addColumn("waist_circumference_cm", "decimal(5, 2)")
    .addColumn("heart_rate", "integer")
    .addColumn("pulse_rate", "integer")
    .addColumn("oxygen_saturation", "decimal(5, 2)")
    .addColumn("respiratory_rate", "integer")
    .addColumn("temperature_celsius", "decimal(4, 2)")
    .addColumn("pain_level", "integer")
    // -----------
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  // Create indexes for vitals
  await db.schema
    .createIndex("idx_patient_vitals_patient_id")
    .on("patient_vitals")
    .column("patient_id")
    .execute();

  await db.schema
    .createIndex("idx_patient_vitals_visit_id")
    .on("patient_vitals")
    .column("visit_id")
    .execute();

  await db.schema
    .createIndex("idx_patient_vitals_timestamp")
    .on("patient_vitals")
    .column("timestamp")
    .execute();

  // 2. Problems Table
  await db.schema
    .createTable("patient_problems")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("patient_id", "uuid", (col) =>
      col.references("patients.id").onDelete("cascade").notNull(),
    )
    .addColumn("visit_id", "uuid", (col) =>
      col.references("visits.id").onDelete("set null"),
    )
    // icd10cm, snomed, icd11, icd10
    .addColumn("problem_code_system", "varchar(50)", (col) => col.notNull())
    // E11.9 for diabetes or I10 for hypertension in icd10
    .addColumn("problem_code", "varchar(100)", (col) => col.notNull())
    // 'Type 2 diabetes mellitus without complications', 'Essential (primary) hypertension'
    .addColumn("problem_label", "varchar(255)", (col) => col.notNull())
    // 'active', 'remission', 'resolved'
    .addColumn("clinical_status", "varchar(50)", (col) => col.notNull())
    // 'provisional', 'confirmed', 'refuted', 'unconfirmed'
    .addColumn("verification_status", "varchar(50)", (col) => col.notNull())
    .addColumn("severity_score", "integer")
    .addColumn("onset_date", "date")
    .addColumn("end_date", "date")
    //-------------------
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  // Create indexes for problems
  await db.schema
    .createIndex("idx_patient_problems_patient_id")
    .on("patient_problems")
    .column("patient_id")
    .execute();

  await db.schema
    .createIndex("idx_patient_problems_visit_id")
    .on("patient_problems")
    .column("visit_id")
    .execute();

  await db.schema
    .createIndex("idx_patient_problems_clinical_status")
    .on("patient_problems")
    .column("clinical_status")
    .execute();

  // 3. Allergies Table
  await db.schema
    .createTable("patient_allergies")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("patient_id", "uuid", (col) =>
      col.references("patients.id").onDelete("cascade").notNull(),
    )
    .addColumn("allergen_code_system", "varchar(50)")
    .addColumn("allergen_code", "varchar(100)")
    .addColumn("allergen_label", "varchar(255)")
    // chronic vs acute
    .addColumn("allergy_type", "varchar(50)")
    // active vs historical
    .addColumn("clinical_status", "varchar(50)", (col) => col.notNull())
    // 'provisional', 'confirmed', 'refuted', 'unconfirmed'
    .addColumn("verification_status", "varchar(50)", (col) => col.notNull())
    .addColumn("severity", "varchar(50)")
    .addColumn("onset_date", "date")
    .addColumn("end_date", "date")
    //-------------------
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  // Create indexes for allergies
  await db.schema
    .createIndex("idx_patient_allergies_patient_id")
    .on("patient_allergies")
    .column("patient_id")
    .execute();

  await db.schema
    .createIndex("idx_patient_allergies_clinical_status")
    .on("patient_allergies")
    .column("clinical_status")
    .execute();

  // 4. Allergy Reactions Table
  await db.schema
    .createTable("patient_allergy_reactions")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("allergy_id", "uuid", (col) =>
      col.references("patient_allergies.id").onDelete("cascade").notNull(),
    )
    .addColumn("reaction_manifestation_code", "varchar(100)")
    .addColumn("reaction_manifestation_label", "varchar(255)", (col) =>
      col.notNull(),
    )
    .addColumn("description", "text")
    .addColumn("severity", "varchar(50)")
    //-------------------
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  // Create index for allergy_reactions
  await db.schema
    .createIndex("idx_patient_allergy_reactions_allergy_id")
    .on("patient_allergy_reactions")
    .column("allergy_id")
    .execute();

  // 5. Tobacco History Table (Specific/Structured)
  await db.schema
    .createTable("patient_tobacco_history")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("patient_id", "uuid", (col) =>
      col.references("patients.id").onDelete("cascade").notNull(),
    )
    // NOTE: no visit_id since tobacco history is not associated with a specific visit, and can change between visits, which would need the tobacco_history to be mutated and the visit_id constantly updated.
    // smoking_status: never smoked, former smoker, current smoker, unknown
    .addColumn("smoking_status", "varchar(50)", (col) => col.notNull())
    .addColumn("type", "varchar(50)")
    .addColumn("packs_per_day", "decimal(4, 2)")
    .addColumn("start_date", "date")
    .addColumn("quit_date", "date")
    //-------------------
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  // Create index for tobacco_history
  await db.schema
    .createIndex("idx_patient_tobacco_history_patient_id")
    .on("patient_tobacco_history")
    .column("patient_id")
    .execute();

  // alcohol_history

  // 6. Observations Table (Generic/Dynamic)
  await db.schema
    .createTable("patient_observations")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("patient_id", "uuid", (col) =>
      col.references("patients.id").onDelete("cascade").notNull(),
    )
    .addColumn("visit_id", "uuid", (col) =>
      col.references("visits.id").onDelete("set null"),
    )
    .addColumn("timestamp", "timestamptz", (col) => col.notNull())
    // LOINC
    .addColumn("observation_code_system", "varchar(50)")
    // specific code (9598-4)
    .addColumn("observation_code", "varchar(100)", (col) => col.notNull())
    // PHQ-9 total score
    .addColumn("observation_label", "varchar(255)")
    .addColumn("value_string", "text")
    .addColumn("value_numeric", "decimal(10, 3)")
    .addColumn("value_boolean", "boolean")
    .addColumn("value_datetime", "timestamptz")
    .addColumn("value_code", "varchar(100)")
    .addColumn("value_unit", "varchar(50)")
    //-------------------
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  // Create indexes for observations
  await db.schema
    .createIndex("idx_patient_observations_patient_id")
    .on("patient_observations")
    .column("patient_id")
    .execute();

  await db.schema
    .createIndex("idx_patient_observations_visit_id")
    .on("patient_observations")
    .column("visit_id")
    .execute();

  await db.schema
    .createIndex("idx_patient_observations_timestamp")
    .on("patient_observations")
    .column("timestamp")
    .execute();

  await db.schema
    .createIndex("idx_patient_observations_code")
    .on("patient_observations")
    .columns(["observation_code_system", "observation_code"])
    .execute();
}

// This function is executed when the migration is rolled back
export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in the reverse order of creation to respect foreign key constraints
  await db.schema.dropTable("patient_observations").ifExists().execute();
  await db.schema.dropTable("patient_tobacco_history").ifExists().execute();
  await db.schema.dropTable("patient_allergy_reactions").ifExists().execute();
  await db.schema.dropTable("patient_allergies").ifExists().execute();
  await db.schema.dropTable("patient_problems").ifExists().execute();
  await db.schema.dropTable("patient_vitals").ifExists().execute();
}
