/**
 * Appointment query procedures (nested under `appointments.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import { flexTimestamp } from "@/lib/rpc-utils";
import * as Sentry from "@sentry/tanstackstart-react";

export const appointmentsQueryRouter = createTRPCRouter({
  /** Retrieve a single appointment by ID */
  get: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const row = await db
          .selectFrom("appointments")
          .selectAll()
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .executeTakeFirst();
        return row ?? null;
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch appointment",
        });
      }
    }),

  /** Retrieve all appointments for a patient */
  by_patient: authedProcedure
    .input(z.object({ patient_id: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await db
          .selectFrom("appointments")
          .selectAll()
          .where("patient_id", "=", input.patient_id)
          .where("is_deleted", "=", false)
          .orderBy("timestamp", "desc")
          .execute();
        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch patient appointments",
        });
      }
    }),

  /**
   * List appointments within a date range with optional filters and pagination.
   *
   * Implementation details:
   * - Filter by start_date..end_date on the `timestamp` column
   * - Optional clinic_id exact match, status exact match
   * - Returns paginated { data, total, limit, offset }
   * - Count query runs in parallel with data query for efficiency
   */
  list: authedProcedure
    .input(
      z.object({
        start_date: flexTimestamp,
        end_date: flexTimestamp,
        clinic_id: z.string().nullish(),
        status: z.string().nullish(),
        limit: z.number().int().positive().max(200).optional(),
        offset: z.number().int().nonnegative().optional(),
      }),
    )
    .query(async () => {
      // Phase 3: full implementation
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "appointments.list: not yet implemented",
      });
    }),

  /**
   * Search appointments by text query with filters.
   *
   * Implementation details:
   * - Text search on patient name (join patients), reason, notes using ILIKE
   * - Filter by clinic_id, department_ids (JSONB overlap), status (array of allowed), date
   * - Returns paginated { data, total, limit, offset }
   * - department_ids filter: `departments::jsonb ?| array[...]`
   */
  search: authedProcedure
    .input(
      z.object({
        search_query: z.string(),
        clinic_id: z.string(),
        department_ids: z.array(z.string()).optional(),
        status: z.array(z.string()).optional(),
        date: flexTimestamp.optional(),
        limit: z.number().int().positive().max(200).optional(),
        offset: z.number().int().nonnegative().optional(),
      }),
    )
    .query(async () => {
      // Phase 3: full implementation
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "appointments.search: not yet implemented",
      });
    }),
});
