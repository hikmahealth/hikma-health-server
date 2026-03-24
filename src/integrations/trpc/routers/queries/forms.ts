/**
 * Registration form and event form query procedures.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import { sql } from "kysely";
import * as Sentry from "@sentry/tanstackstart-react";

export const registrationFormQueryRouter = createTRPCRouter({
  /** Get the most recently updated registration form, with optional language filter */
  get: authedProcedure
    .input(
      z
        .object({ language: z.string().nullish() })
        .optional(),
    )
    .query(async ({ input: _input }) => {
      try {
        // Language filtering of field labels is done client-side;
        // this endpoint returns the most recent form regardless of language.
        const query = db
          .selectFrom("patient_registration_forms")
          .selectAll()
          .where("is_deleted", "=", false);

        const form = await query
          .orderBy("updated_at", "desc")
          .limit(1)
          .executeTakeFirst();

        if (!form) {
          return { error: "No registration form found" };
        }
        return form;
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch registration form",
        });
      }
    }),
});

export const allRegistrationFormsQueryRouter = createTRPCRouter({
  /** Retrieve all registration forms including deleted ones */
  list: authedProcedure.query(async () => {
    try {
      const data = await db
        .selectFrom("patient_registration_forms")
        .selectAll()
        .orderBy("updated_at", "desc")
        .execute();
      return { data };
    } catch (error) {
      Sentry.captureException(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch registration forms",
      });
    }
  }),
});

export const eventFormsQueryRouter = createTRPCRouter({
  /** List event forms with optional language and clinic filters */
  list: authedProcedure
    .input(
      z
        .object({
          language: z.string().nullish(),
          clinic_id: z.string().nullish(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      try {
        let query = db
          .selectFrom("event_forms")
          .selectAll()
          .where("is_deleted", "=", false);

        if (input?.language) {
          query = query.where("language", "=", input.language);
        }

        if (input?.clinic_id) {
          // clinic_ids is a JSONB array; filter forms available to this clinic
          // Include forms with null/empty clinic_ids (available to all clinics)
          const clinicId = input.clinic_id;
          query = query.where(({ or, eb }) =>
            or([
              eb("clinic_ids", "is", null),
              eb(sql`clinic_ids`, "=", sql`'[]'::jsonb`),
              eb(sql`clinic_ids`, "@>", sql`${JSON.stringify([clinicId])}::jsonb`),
            ]),
          );
        }

        const data = await query.orderBy("name", "asc").execute();
        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch event forms",
        });
      }
    }),
});
