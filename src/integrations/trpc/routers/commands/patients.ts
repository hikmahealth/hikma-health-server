/**
 * Patient command procedures (nested under `patients.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import { sql } from "kysely";
import { logAuditEvent } from "@/lib/server-functions/audit";
import * as Sentry from "@sentry/tanstackstart-react";

export const patientsCommandRouter = createTRPCRouter({
  /** Soft-delete a patient by setting deleted_at and is_deleted */
  delete: authedProcedure
    .input(z.object({ patient_id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db
          .updateTable("patients")
          .set({
            is_deleted: true,
            deleted_at: sql`now()::timestamp with time zone`,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", input.patient_id)
          .where("is_deleted", "=", false)
          .executeTakeFirst();

        await logAuditEvent({
          actionType: "SOFT_DELETE",
          tableName: "patients",
          rowId: input.patient_id,
          changes: { soft_delete: true },
          userId: ctx.userId,
        });

        return { deleted: true, patient_id: input.patient_id };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to delete patient",
        });
      }
    }),
});
