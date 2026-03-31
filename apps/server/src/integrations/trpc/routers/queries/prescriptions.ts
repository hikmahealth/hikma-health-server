/**
 * Prescription and prescription item query procedures.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import { flexTimestamp } from "@/lib/rpc-utils";
import * as Sentry from "@sentry/tanstackstart-react";

export const prescriptionsQueryRouter = createTRPCRouter({
  /** Retrieve all prescriptions for a specific patient + visit */
  by_patient_visit: authedProcedure
    .input(
      z.object({
        patient_id: z.string(),
        visit_id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const data = await db
          .selectFrom("prescriptions")
          .selectAll()
          .where("patient_id", "=", input.patient_id)
          .where("visit_id", "=", input.visit_id)
          .where("is_deleted", "=", false)
          .orderBy("created_at", "desc")
          .execute();
        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch prescriptions",
        });
      }
    }),

  /**
   * Search prescriptions with optional filters.
   *
   * Implementation details:
   * - Optional text search on notes, items (JSONB text), and joined patient name via ILIKE
   * - Filter by clinic_id (pickup_clinic_id), status (array of allowed values), date
   * - Returns paginated { data, total, limit, offset }
   * - status filter: WHERE status IN (...)
   * - date filter: WHERE prescribed_at on the given day (truncate to day boundaries)
   */
  search: authedProcedure
    .input(
      z.object({
        search_query: z.string().nullish(),
        clinic_id: z.string().nullish(),
        status: z.array(z.string()).optional(),
        date: flexTimestamp.nullish(),
        limit: z.number().int().positive().max(200).optional(),
        offset: z.number().int().nonnegative().optional(),
      }),
    )
    .query(async () => {
      // Phase 3: full implementation
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "prescriptions.search: not yet implemented",
      });
    }),
});

export const prescriptionItemsQueryRouter = createTRPCRouter({
  /** Retrieve all items for a prescription */
  by_prescription: authedProcedure
    .input(z.object({ prescription_id: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await db
          .selectFrom("prescription_items")
          .selectAll()
          .where("prescription_id", "=", input.prescription_id)
          .where("is_deleted", "=", false)
          .orderBy("created_at", "asc")
          .execute();
        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch prescription items",
        });
      }
    }),

  /** Retrieve all prescription items for a patient (across all prescriptions) */
  by_patient: authedProcedure
    .input(z.object({ patient_id: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await db
          .selectFrom("prescription_items")
          .selectAll()
          .where("patient_id", "=", input.patient_id)
          .where("is_deleted", "=", false)
          .orderBy("created_at", "desc")
          .execute();
        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch patient prescription items",
        });
      }
    }),
});
