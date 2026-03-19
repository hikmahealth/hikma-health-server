/**
 * tRPC query procedures (CQRS read side).
 * Served at /rpc/query via fetchRequestHandler.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { authedProcedure, publicProcedure } from "../init";
import Patient from "@/models/patient";
import Visit from "@/models/visit";
import Event from "@/models/event";
import EventForm from "@/models/event-form";
import db from "@/db";
import { sql } from "kysely";
import * as Sentry from "@sentry/tanstackstart-react";

/** Columns that live directly on the patients table (used for search filtering) */
const PATIENT_COLUMNS = new Set([
  "given_name",
  "surname",
  "date_of_birth",
  "citizenship",
  "hometown",
  "phone",
  "sex",
  "camp",
  "government_id",
  "external_patient_id",
  "id",
]);

export const queryProcedures = {
  /** Health check / connectivity probe */
  ping: publicProcedure.query(() => ({ pong: true as const })),

  /** Liveness probe returning service status */
  heartbeat: publicProcedure.query(() => ({ status: "ok" as const })),

  /** Filter-based patient search with per-column LIKE and attribute filters */
  search_patients: authedProcedure
    .input(
      z.object({
        filters: z.record(z.string(), z.string()),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { filters, limit = 50, offset = 0 } = input;

        let query = db
          .selectFrom(Patient.Table.name)
          .selectAll()
          .where("is_deleted", "=", false);

        for (const [key, value] of Object.entries(filters)) {
          if (PATIENT_COLUMNS.has(key)) {
            // Direct column filter with LIKE
            query = query.where(key as any, "like", `%${value}%`);
          } else {
            // Treat as an additional attribute filter
            query = query.where(({ exists, selectFrom }) =>
              exists(
                selectFrom("patient_additional_attributes" as any)
                  .select(sql`1`.as("one"))
                  .whereRef(
                    "patient_id" as any,
                    "=",
                    `${Patient.Table.name}.id` as any,
                  )
                  .where("attribute_id" as any, "=", key)
                  .where("string_value" as any, "like", `%${value}%`)
                  .where("is_deleted" as any, "=", false),
              ),
            );
          }
        }

        const items = await query
          .orderBy("updated_at", "desc")
          .limit(limit)
          .offset(offset)
          .execute();

        return { items };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to search patients",
        });
      }
    }),

  /** Get a paginated list of all active patients with their attributes */
  get_patients: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().optional(),
          offset: z.number().int().nonnegative().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      try {
        const result = await Patient.API.getAllWithAttributes({
          limit: input?.limit,
          offset: input?.offset ?? 0,
          includeCount: true,
        });
        return result;
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch patients",
        });
      }
    }),

  /** Hub-compatible alias for get_patient_visits */
  get_visits: authedProcedure
    .input(
      z.object({
        patient_id: z.string(),
        offset: z.number().int().nonnegative().optional(),
        limit: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await Visit.API.getByPatientId({
          patientId: input.patient_id,
          limit: input.limit ?? 50,
          offset: input.offset ?? 0,
          includeCount: true,
        });

        return {
          items: result.items,
          pagination: result.pagination,
        };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch visits",
        });
      }
    }),

  /** Get the most recently updated patient registration form */
  get_patient_registration_form: authedProcedure.query(async () => {
    try {
      const form = await db
        .selectFrom("patient_registration_forms")
        .selectAll()
        .where("is_deleted", "=", false)
        .orderBy("updated_at", "desc")
        .limit(1)
        .executeTakeFirst();

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No patient registration form found",
        });
      }

      return form;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      Sentry.captureException(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch patient registration form",
      });
    }
  }),
  /** Get paginated visits for a patient, ordered by most recent first */
  get_patient_visits: authedProcedure
    .input(
      z.object({
        patient_id: z.string(),
        offset: z.number().int().nonnegative().optional(),
        limit: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await Visit.API.getByPatientId({
          patientId: input.patient_id,
          limit: input.limit ?? 50,
          offset: input.offset ?? 0,
          includeCount: true,
        });

        return {
          items: result.items,
          pagination: result.pagination,
        };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch visits",
        });
      }
    }),

  /** Get all non-deleted events for a visit, ordered by most recent first */
  get_visit_events: authedProcedure
    .input(z.object({ visit_id: z.string() }))
    .query(async ({ input }) => {
      try {
        const items = await Event.API.getByVisitId(input.visit_id);
        return { items };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch events",
        });
      }
    }),

  /** Get a single event form by ID */
  get_event_form: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const form = await EventForm.API.getById(input.id);
        if (!form) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Event form not found: ${input.id}`,
          });
        }
        return form;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch event form",
        });
      }
    }),

  /** Get all event forms */
  get_event_forms: authedProcedure.query(async () => {
    try {
      return await EventForm.API.getAll();
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
} satisfies TRPCRouterRecord;
