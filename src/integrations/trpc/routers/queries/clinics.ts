/**
 * Clinic and department query procedures (nested under `clinics.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import * as Sentry from "@sentry/tanstackstart-react";

export const clinicsQueryRouter = createTRPCRouter({
  /** Retrieve all active (non-deleted) clinics */
  list: authedProcedure.query(async () => {
    try {
      const data = await db
        .selectFrom("clinics")
        .selectAll()
        .where("is_deleted", "=", false)
        .orderBy("name", "asc")
        .execute();
      return { data };
    } catch (error) {
      Sentry.captureException(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to fetch clinics",
      });
    }
  }),
});

export const clinicDepartmentsQueryRouter = createTRPCRouter({
  /** Retrieve all departments for a clinic */
  list: authedProcedure
    .input(z.object({ clinic_id: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await db
          .selectFrom("clinic_departments")
          .selectAll()
          .where("clinic_id", "=", input.clinic_id)
          .where("is_deleted", "=", false)
          .orderBy("name", "asc")
          .execute();
        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch clinic departments",
        });
      }
    }),
});
