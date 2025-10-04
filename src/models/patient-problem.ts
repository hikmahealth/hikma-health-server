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

namespace PatientProblem {
  export const PatientProblemSchema = Schema.Struct({
    id: Schema.String,
    patient_id: Schema.String,
    visit_id: Schema.OptionFromNullOr(Schema.String),
    problem_code_system: Schema.String,
    problem_code: Schema.String,
    problem_label: Schema.String,
    clinical_status: Schema.String,
    verification_status: Schema.String,
    severity_score: Schema.OptionFromNullOr(Schema.Number),
    onset_date: Schema.OptionFromNullOr(Schema.DateFromSelf),
    end_date: Schema.OptionFromNullOr(Schema.DateFromSelf),
    recorded_by_user_id: Schema.OptionFromNullOr(Schema.String),
    metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    is_deleted: Schema.Boolean,
    created_at: Schema.DateFromSelf,
    updated_at: Schema.DateFromSelf,
    last_modified: Schema.DateFromSelf,
    server_created_at: Schema.DateFromSelf,
    deleted_at: Schema.OptionFromNullOr(Schema.DateFromSelf),
  });

  export type T = typeof PatientProblemSchema.Type;
  export type EncodedT = typeof PatientProblemSchema.Encoded;

  export const fromDbEntry = (
    entry: PatientProblem.Table.PatientProblems,
  ): Either.Either<PatientProblem.T, Error> => {
    return Schema.decodeUnknownEither(PatientProblemSchema)(entry);
  };

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = false;
    export const name = "patient_problems";
    /** The name of the table in the mobile database */
    export const mobileName = "patient_problems";
    export const columns = {
      id: "id",
      patient_id: "patient_id",
      visit_id: "visit_id",
      problem_code_system: "problem_code_system",
      problem_code: "problem_code",
      problem_label: "problem_label",
      clinical_status: "clinical_status",
      verification_status: "verification_status",
      severity_score: "severity_score",
      onset_date: "onset_date",
      end_date: "end_date",
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
      problem_code_system: string;
      problem_code: string;
      problem_label: string;
      clinical_status: string;
      verification_status: string;
      severity_score: number | null;
      onset_date: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      end_date: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
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

    export type PatientProblems = Selectable<T>;
    export type NewPatientProblems = Insertable<T>;
    export type PatientProblemsUpdate = Updateable<T>;
  }

  // Enums for common values
  export const ClinicalStatus = {
    ACTIVE: "active",
    REMISSION: "remission",
    RESOLVED: "resolved",
  } as const;

  export const VerificationStatus = {
    PROVISIONAL: "provisional",
    CONFIRMED: "confirmed",
    REFUTED: "refuted",
    UNCONFIRMED: "unconfirmed",
  } as const;

  export const ProblemCodeSystem = {
    ICD10CM: "icd10cm",
    SNOMED: "snomed",
    ICD11: "icd11",
    ICD10: "icd10",
  } as const;

  /**
   * Create a new patient problem record
   * @param problem - The problem data to create
   * @returns {Promise<EncodedT>} - The created problem record
   */
  export const create = serverOnly(
    async (
      problem: Omit<Table.NewPatientProblems, "id">,
    ): Promise<EncodedT> => {
      const id = uuidV1();
      const result = await db
        .insertInto(Table.name)
        .values({
          ...problem,
          id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    },
  );

  /**
   * Get all problems for a patient
   * @param patientId - The patient ID
   * @returns {Promise<EncodedT[]>} - List of problem records
   */
  export const getByPatientId = serverOnly(
    async (patientId: string): Promise<EncodedT[]> => {
      const result = await db
        .selectFrom(Table.name)
        .where("patient_id", "=", patientId)
        .where("is_deleted", "=", false)
        .orderBy("created_at", "desc")
        .selectAll()
        .execute();

      return result;
    },
  );

  /**
   * Get active problems for a patient
   * @param patientId - The patient ID
   * @returns {Promise<EncodedT[]>} - List of active problem records
   */
  export const getActiveProblems = serverOnly(
    async (patientId: string): Promise<EncodedT[]> => {
      const result = await db
        .selectFrom(Table.name)
        .where("patient_id", "=", patientId)
        .where("clinical_status", "=", ClinicalStatus.ACTIVE)
        .where("is_deleted", "=", false)
        .orderBy("severity_score", "desc")
        .orderBy("onset_date", "desc")
        .selectAll()
        .execute();

      return result;
    },
  );

  /**
   * Get problems for a specific visit
   * @param visitId - The visit ID
   * @returns {Promise<EncodedT[]>} - List of problem records for the visit
   */
  export const getByVisitId = serverOnly(
    async (visitId: string): Promise<EncodedT[]> => {
      const result = await db
        .selectFrom(Table.name)
        .where("visit_id", "=", visitId)
        .where("is_deleted", "=", false)
        .orderBy("severity_score", "desc")
        .selectAll()
        .execute();

      return result;
    },
  );

  /**
   * Get a problem by ID
   * @param id - The problem ID
   * @returns {Promise<EncodedT | undefined>} - The problem record
   */
  export const getById = serverOnly(
    async (id: string): Promise<EncodedT | undefined> => {
      const result = await db
        .selectFrom(Table.name)
        .where("id", "=", id)
        .where("is_deleted", "=", false)
        .selectAll()
        .executeTakeFirst();

      return result;
    },
  );

  /**
   * Update a problem record
   * @param id - The problem record ID
   * @param updates - The updates to apply
   * @returns {Promise<EncodedT>} - The updated problem record
   */
  export const update = serverOnly(
    async (
      id: string,
      updates: Table.PatientProblemsUpdate,
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
   * Soft delete a problem record
   * @param id - The problem record ID
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
   * Search problems by code or label
   * @param searchTerm - The search term
   * @param codeSystem - Optional code system filter
   * @returns {Promise<EncodedT[]>} - List of matching problem records
   */
  export const search = serverOnly(
    async (searchTerm: string, codeSystem?: string): Promise<EncodedT[]> => {
      let query = db
        .selectFrom(Table.name)
        .where("is_deleted", "=", false)
        .where((eb) =>
          eb.or([
            eb("problem_code", "ilike", `%${searchTerm}%`),
            eb("problem_label", "ilike", `%${searchTerm}%`),
          ]),
        );

      if (codeSystem) {
        query = query.where("problem_code_system", "=", codeSystem);
      }

      const result = await query.orderBy("problem_label").selectAll().execute();

      return result;
    },
  );

  /**
   * Get problems by clinical status
   * @param patientId - The patient ID
   * @param clinicalStatus - The clinical status
   * @returns {Promise<EncodedT[]>} - List of problem records
   */
  export const getByClinicalStatus = serverOnly(
    async (patientId: string, clinicalStatus: string): Promise<EncodedT[]> => {
      const result = await db
        .selectFrom(Table.name)
        .where("patient_id", "=", patientId)
        .where("clinical_status", "=", clinicalStatus)
        .where("is_deleted", "=", false)
        .orderBy("onset_date", "desc")
        .selectAll()
        .execute();

      return result;
    },
  );

  export namespace Sync {
    export const upsertFromDelta = serverOnly(
      async (deltaData: Table.NewPatientProblems): Promise<void> => {
        await db
          .insertInto(Table.name)
          .values(deltaData)
          .onConflict((oc) =>
            oc.column("id").doUpdateSet((eb) => ({
              ...deltaData,
              server_created_at: eb.ref("patient_problems.server_created_at"),
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

export default PatientProblem;
