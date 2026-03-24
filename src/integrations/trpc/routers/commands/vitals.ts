/**
 * Patient vitals command procedures (nested under `vitals.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import { sql } from "kysely";
import { flexTimestampOptional } from "@/lib/rpc-utils";
import { logAuditEvent } from "@/lib/server-functions/audit";
import * as Sentry from "@sentry/tanstackstart-react";

export const vitalsCommandRouter = createTRPCRouter({
  /** Update a patient vitals record. Only provided fields are changed. */
  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        systolic_bp: z.number().nullish(),
        diastolic_bp: z.number().nullish(),
        bp_position: z.string().nullish(),
        height_cm: z.number().nullish(),
        weight_kg: z.number().nullish(),
        bmi: z.number().nullish(),
        waist_circumference_cm: z.number().nullish(),
        heart_rate: z.number().nullish(),
        pulse_rate: z.number().nullish(),
        oxygen_saturation: z.number().nullish(),
        respiratory_rate: z.number().nullish(),
        temperature_celsius: z.number().nullish(),
        pain_level: z.number().nullish(),
        metadata: z.string().nullish(),
        updated_at: flexTimestampOptional,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, updated_at, metadata, ...numericFields } = input;
        const updateSet: Record<string, unknown> = {};

        // Apply numeric fields that were explicitly provided
        for (const [key, value] of Object.entries(numericFields)) {
          if (value !== undefined) {
            updateSet[key] = value;
          }
        }

        if (metadata !== undefined) {
          updateSet.metadata = metadata
            ? sql`${metadata}::jsonb`
            : null;
        }

        updateSet.updated_at = sql`now()::timestamp with time zone`;
        updateSet.last_modified = sql`now()::timestamp with time zone`;

        await db
          .updateTable("patient_vitals")
          .set(updateSet)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();

        await logAuditEvent({
          actionType: "UPDATE",
          tableName: "patient_vitals",
          rowId: id,
          changes: input,
          userId: ctx.userId,
        });

        return { ok: true, id };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to update vitals",
        });
      }
    }),
});
