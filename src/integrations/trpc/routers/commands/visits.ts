/**
 * Visit command procedures (nested under `visits.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import { sql } from "kysely";
import { flexTimestampOptional, toSqlTimestamp } from "@/lib/rpc-utils";
import { logAuditEvent } from "@/lib/server-functions/audit";
import * as Sentry from "@sentry/tanstackstart-react";

export const visitsCommandRouter = createTRPCRouter({
  /** Update mutable fields on an existing visit. Only provided fields are changed. */
  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        provider_id: z.string().nullish(),
        provider_name: z.string().nullish(),
        check_in_timestamp: flexTimestampOptional,
        metadata: z.string().nullish(),
        clinic_id: z.string().nullish(),
        updated_at: flexTimestampOptional,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const updateSet: Record<string, unknown> = {};

        if (input.provider_id !== undefined)
          updateSet.provider_id = input.provider_id;
        if (input.provider_name !== undefined)
          updateSet.provider_name = input.provider_name;
        if (input.check_in_timestamp !== undefined && input.check_in_timestamp !== null)
          updateSet.check_in_timestamp = toSqlTimestamp(input.check_in_timestamp);
        if (input.metadata !== undefined)
          updateSet.metadata = input.metadata
            ? sql`${input.metadata}::jsonb`
            : null;
        if (input.clinic_id !== undefined)
          updateSet.clinic_id = input.clinic_id;

        updateSet.updated_at = sql`now()::timestamp with time zone`;
        updateSet.last_modified = sql`now()::timestamp with time zone`;

        await db
          .updateTable("visits")
          .set(updateSet)
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .execute();

        // Return full visit object
        const visit = await db
          .selectFrom("visits")
          .selectAll()
          .where("id", "=", input.id)
          .executeTakeFirst();

        if (!visit) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Visit '${input.id}' not found`,
          });
        }

        await logAuditEvent({
          actionType: "UPDATE",
          tableName: "visits",
          rowId: input.id,
          changes: input,
          userId: ctx.userId,
        });

        return visit;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to update visit",
        });
      }
    }),
});
