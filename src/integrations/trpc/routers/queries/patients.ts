/**
 * Patient query procedures (nested under `patients.*` in the query router).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure } from "../../init";
import { createTRPCRouter } from "../../init";
import db from "@/db";
import { sql } from "kysely";
import * as Sentry from "@sentry/tanstackstart-react";

export const patientsQueryRouter = createTRPCRouter({
  /** Retrieve a single patient with registration form fields and attribute values */
  get: authedProcedure
    .input(z.object({ patient_id: z.string() }))
    .query(async ({ input }) => {
      try {
        const patient = await db
          .selectFrom("patients")
          .selectAll()
          .where("id", "=", input.patient_id)
          .where("is_deleted", "=", false)
          .executeTakeFirst();

        if (!patient) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Patient '${input.patient_id}' not found`,
          });
        }

        // Fetch the most recent registration form for field definitions
        const form = await db
          .selectFrom("patient_registration_forms")
          .selectAll()
          .where("is_deleted", "=", false)
          .orderBy("updated_at", "desc")
          .limit(1)
          .executeTakeFirst();

        const fields = form
          ? (typeof form.fields === "string"
              ? JSON.parse(form.fields)
              : form.fields)
          : [];

        // Fetch additional attributes keyed by attribute_id
        const attrs = await db
          .selectFrom("patient_additional_attributes")
          .selectAll()
          .where("patient_id", "=", input.patient_id)
          .where("is_deleted", "=", false)
          .execute();

        // Build values map: base patient columns + attribute values keyed by attribute column
        const values: Record<string, unknown> = {
          id: patient.id,
          given_name: patient.given_name,
          surname: patient.surname,
          date_of_birth: patient.date_of_birth,
          citizenship: patient.citizenship,
          hometown: patient.hometown,
          phone: patient.phone,
          sex: patient.sex,
          camp: patient.camp,
          government_id: patient.government_id,
          external_patient_id: patient.external_patient_id,
          photo_url: patient.photo_url,
          additional_data: patient.additional_data,
          metadata: patient.metadata,
          primary_clinic_id: patient.primary_clinic_id,
        };

        for (const attr of attrs) {
          values[attr.attribute_id] =
            attr.string_value ?? attr.number_value ?? attr.date_value ?? attr.boolean_value;
        }

        return { fields, values };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch patient",
        });
      }
    }),

  /** Check whether a government ID already exists */
  check_government_id: authedProcedure
    .input(z.object({ government_id: z.string() }))
    .query(async ({ input }) => {
      try {
        const row = await db
          .selectFrom("patients")
          .select(sql`1`.as("one"))
          .where("government_id", "=", input.government_id)
          .where("is_deleted", "=", false)
          .executeTakeFirst();

        return { exists: !!row };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to check government ID",
        });
      }
    }),

  /**
   * Find patients with similar names using native Postgres text operations.
   * Ranks by: exact match > prefix match > contains, using ILIKE.
   *
   * Implementation details:
   * - Uses LOWER + ILIKE for case-insensitive matching
   * - Scoring: exact=3, starts-with=2, contains=1, per name part
   * - Combined score is summed and sorted descending
   * - No pg_trgm or fuzzystrmatch extension required
   */
  similar: authedProcedure
    .input(
      z.object({
        given_name: z.string(),
        surname: z.string(),
        limit: z.number().int().positive().max(100).optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { given_name, surname, limit = 20 } = input;
        const gn = given_name.trim().toLowerCase();
        const sn = surname.trim().toLowerCase();

        if (!gn && !sn) return { data: [] };

        // Score each name part: exact=3, prefix=2, contains=1
        // Use CASE expressions in SQL for ranking
        const data = await db
          .selectFrom("patients")
          .selectAll()
          .select(
            sql<number>`(
              CASE
                WHEN LOWER(given_name) = ${gn} THEN 3
                WHEN LOWER(given_name) LIKE ${gn + "%"} THEN 2
                WHEN LOWER(given_name) LIKE ${"%" + gn + "%"} THEN 1
                ELSE 0
              END
              +
              CASE
                WHEN LOWER(surname) = ${sn} THEN 3
                WHEN LOWER(surname) LIKE ${sn + "%"} THEN 2
                WHEN LOWER(surname) LIKE ${"%" + sn + "%"} THEN 1
                ELSE 0
              END
            )`.as("similarity_score"),
          )
          .where("is_deleted", "=", false)
          .where(({ or, eb }) =>
            or([
              eb(sql`LOWER(given_name)`, "like", "%" + gn + "%"),
              eb(sql`LOWER(surname)`, "like", "%" + sn + "%"),
            ]),
          )
          .orderBy(sql`similarity_score`, "desc")
          .limit(limit)
          .execute();

        // Strip the computed score from results
        return {
          data: data.map(({ similarity_score, ...patient }) => patient),
        };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to search similar patients",
        });
      }
    }),
});
