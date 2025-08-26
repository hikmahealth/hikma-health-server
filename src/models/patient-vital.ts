import { Option, Schema, Either } from "effect";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  type JSONColumnType,
  sql,
} from "kysely";
import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
import { v1 as uuidV1 } from "uuid";

namespace PatientVital {
  export const PatientVitalSchema = Schema.Struct({
    id: Schema.String,
    patient_id: Schema.String,
    visit_id: Schema.OptionFromNullOr(Schema.String),
    timestamp: Schema.DateFromSelf,
    systolic_bp: Schema.OptionFromNullOr(Schema.Number),
    diastolic_bp: Schema.OptionFromNullOr(Schema.Number),
    bp_position: Schema.OptionFromNullOr(Schema.String),
    height_cm: Schema.OptionFromNullOr(Schema.Number),
    weight_kg: Schema.OptionFromNullOr(Schema.Number),
    bmi: Schema.OptionFromNullOr(Schema.Number),
    waist_circumference_cm: Schema.OptionFromNullOr(Schema.Number),
    heart_rate: Schema.OptionFromNullOr(Schema.Number),
    pulse_rate: Schema.OptionFromNullOr(Schema.Number),
    oxygen_saturation: Schema.OptionFromNullOr(Schema.Number),
    respiratory_rate: Schema.OptionFromNullOr(Schema.Number),
    temperature_celsius: Schema.OptionFromNullOr(Schema.Number),
    pain_level: Schema.OptionFromNullOr(Schema.Number),
    recorded_by_user_id: Schema.OptionFromNullOr(Schema.String),
    metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    is_deleted: Schema.Boolean,
    created_at: Schema.DateFromSelf,
    updated_at: Schema.DateFromSelf,
    last_modified: Schema.DateFromSelf,
    server_created_at: Schema.DateFromSelf,
    deleted_at: Schema.OptionFromNullOr(Schema.DateFromSelf),
  });

  export type T = typeof PatientVitalSchema.Type;
  export type EncodedT = typeof PatientVitalSchema.Encoded;

  export const fromDbEntry = (
    entry: PatientVital.Table.PatientVitals,
  ): Either.Either<PatientVital.T, Error> => {
    return Schema.decodeUnknownEither(PatientVitalSchema)(entry);
  };

  export namespace Table {
    export const name = "patient_vitals";
    /** The name of the table in the mobile database */
    export const mobileName = "patient_vitals";
    export const columns = {
      id: "id",
      patient_id: "patient_id",
      visit_id: "visit_id",
      timestamp: "timestamp",
      systolic_bp: "systolic_bp",
      diastolic_bp: "diastolic_bp",
      bp_position: "bp_position",
      height_cm: "height_cm",
      weight_kg: "weight_kg",
      bmi: "bmi",
      waist_circumference_cm: "waist_circumference_cm",
      heart_rate: "heart_rate",
      pulse_rate: "pulse_rate",
      oxygen_saturation: "oxygen_saturation",
      respiratory_rate: "respiratory_rate",
      temperature_celsius: "temperature_celsius",
      pain_level: "pain_level",
      recorded_by_user_id: "recorded_by_user_id",
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
      timestamp: ColumnType<Date, string | undefined, string>;
      systolic_bp: number | null;
      diastolic_bp: number | null;
      bp_position: string | null;
      height_cm: number | null;
      weight_kg: number | null;
      bmi: number | null;
      waist_circumference_cm: number | null;
      heart_rate: number | null;
      pulse_rate: number | null;
      oxygen_saturation: number | null;
      respiratory_rate: number | null;
      temperature_celsius: number | null;
      pain_level: number | null;
      recorded_by_user_id: string | null;
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

    export type PatientVitals = Selectable<T>;
    export type NewPatientVitals = Insertable<T>;
    export type PatientVitalsUpdate = Updateable<T>;
  }

  /**
   * Create a new patient vital record
   * @param vital - The vital data to create
   * @returns {Promise<EncodedT>} - The created vital record
   */
  export const create = serverOnly(
    async (vital: Omit<Table.NewPatientVitals, "id">): Promise<EncodedT> => {
      const id = uuidV1();
      const result = await db
        .insertInto(Table.name)
        .values({
          ...vital,
          id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    },
  );

  /**
   * Get all vitals for a patient
   * @param patientId - The patient ID
   * @returns {Promise<EncodedT[]>} - List of vital records
   */
  export const getByPatientId = serverOnly(
    async (patientId: string): Promise<EncodedT[]> => {
      const result = await db
        .selectFrom(Table.name)
        .where("patient_id", "=", patientId)
        .where("is_deleted", "=", false)
        .orderBy("timestamp", "desc")
        .selectAll()
        .execute();

      return result;
    },
  );

  /**
   * Get vitals for a specific visit
   * @param visitId - The visit ID
   * @returns {Promise<EncodedT[]>} - List of vital records for the visit
   */
  export const getByVisitId = serverOnly(
    async (visitId: string): Promise<EncodedT[]> => {
      const result = await db
        .selectFrom(Table.name)
        .where("visit_id", "=", visitId)
        .where("is_deleted", "=", false)
        .orderBy("timestamp", "desc")
        .selectAll()
        .execute();

      return result;
    },
  );

  /**
   * Get the most recent vitals for a patient
   * @param patientId - The patient ID
   * @returns {Promise<EncodedT | undefined>} - The most recent vital record
   */
  export const getMostRecent = serverOnly(
    async (patientId: string): Promise<EncodedT | undefined> => {
      const result = await db
        .selectFrom(Table.name)
        .where("patient_id", "=", patientId)
        .where("is_deleted", "=", false)
        .orderBy("timestamp", "desc")
        .selectAll()
        .limit(1)
        .executeTakeFirst();

      return result;
    },
  );

  /**
   * Update a vital record
   * @param id - The vital record ID
   * @param updates - The updates to apply
   * @returns {Promise<EncodedT>} - The updated vital record
   */
  export const update = serverOnly(
    async (
      id: string,
      updates: Table.PatientVitalsUpdate,
    ): Promise<EncodedT> => {
      const result = await db
        .updateTable(Table.name)
        .set({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    },
  );

  /**
   * Soft delete a vital record
   * @param id - The vital record ID
   * @returns {Promise<void>}
   */
  export const softDelete = serverOnly(async (id: string): Promise<void> => {
    await db
      .updateTable(Table.name)
      .set({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .where("id", "=", id)
      .execute();
  });

  /**
   * Get vitals within a date range for a patient
   * @param patientId - The patient ID
   * @param startDate - Start date of the range
   * @param endDate - End date of the range
   * @returns {Promise<EncodedT[]>} - List of vital records
   */
  export const getByDateRange = serverOnly(
    async (
      patientId: string,
      startDate: Date,
      endDate: Date,
    ): Promise<EncodedT[]> => {
      const result = await db
        .selectFrom(Table.name)
        .where("patient_id", "=", patientId)
        .where("timestamp", ">=", startDate.toISOString())
        .where("timestamp", "<=", endDate.toISOString())
        .where("is_deleted", "=", false)
        .orderBy("timestamp", "desc")
        .selectAll()
        .execute();

      return result;
    },
  );

  export namespace Sync {
    export const upsertFromDelta = serverOnly(
      async (deltaData: Table.NewPatientVitals): Promise<void> => {
        await db
          .insertInto(Table.name)
          .values(deltaData)
          .onConflict((oc) =>
            oc.column("id").doUpdateSet((eb) => ({
              ...deltaData,
              server_created_at: eb.ref("patient_vitals.server_created_at"),
            })),
          )
          .execute();
      },
    );

    export const deleteFromDelta = serverOnly(
      async (id: string): Promise<void> => {
        await softDelete(id);
      },
    );
  }
}

export default PatientVital;
