/**
 * Prescription command procedures (nested under `prescriptions.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import Prescription from "@/models/prescription";
import db from "@/db";
import { sql } from "kysely";
import { flexTimestamp, flexTimestampOptional, toSqlTimestamp } from "@/lib/rpc-utils";
import { logAuditEvent } from "@/lib/server-functions/audit";
import { uuidv7 } from "uuidv7";
import * as Sentry from "@sentry/tanstackstart-react";

export const prescriptionsCommandRouter = createTRPCRouter({
  /**
   * Create a new prescription (upsert on id conflict).
   * Uses direct DB queries rather than Prescription.API.save because the model's
   * save method is designed for the web UI flow (auto-creates visits, resolves
   * clinic IDs, handles prescription_items in the same transaction). Hub clients
   * provide all IDs and timestamps directly, and create items separately.
   */
  create: authedProcedure
    .input(
      z.object({
        id: z.string().nullish(),
        patient_id: z.string(),
        provider_id: z.string(),
        filled_by: z.string().nullish(),
        pickup_clinic_id: z.string().nullish(),
        visit_id: z.string().nullish(),
        priority: z.string().nullish(),
        expiration_date: flexTimestampOptional,
        prescribed_at: flexTimestamp,
        filled_at: flexTimestampOptional,
        status: z.string(),
        items: z.string(),
        notes: z.string(),
        metadata: z.string(),
        created_at: flexTimestamp,
        updated_at: flexTimestamp,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const prescriptionId = input.id ?? uuidv7();

        const insertValues = {
          id: prescriptionId,
          patient_id: input.patient_id,
          provider_id: input.provider_id,
          filled_by: input.filled_by ?? null,
          pickup_clinic_id: input.pickup_clinic_id ?? null,
          visit_id: input.visit_id ?? null,
          priority: input.priority ?? null,
          expiration_date:
            input.expiration_date != null
              ? toSqlTimestamp(input.expiration_date)
              : null,
          prescribed_at: toSqlTimestamp(input.prescribed_at),
          filled_at:
            input.filled_at != null
              ? toSqlTimestamp(input.filled_at)
              : null,
          status: input.status,
          items: sql`${input.items}::jsonb`,
          notes: input.notes,
          metadata: sql`${input.metadata}::jsonb`,
          is_deleted: false,
          created_at: toSqlTimestamp(input.created_at),
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
          server_created_at: sql`now()::timestamp with time zone`,
          deleted_at: null,
        };

        await db
          .insertInto(Prescription.Table.name)
          .values(insertValues as any)
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              filled_by: input.filled_by ?? null,
              pickup_clinic_id: input.pickup_clinic_id ?? null,
              visit_id: input.visit_id ?? null,
              priority: input.priority ?? null,
              expiration_date:
                input.expiration_date != null
                  ? toSqlTimestamp(input.expiration_date)
                  : null,
              prescribed_at: toSqlTimestamp(input.prescribed_at),
              filled_at:
                input.filled_at != null
                  ? toSqlTimestamp(input.filled_at)
                  : null,
              status: input.status,
              items: sql`${input.items}::jsonb`,
              notes: input.notes,
              metadata: sql`${input.metadata}::jsonb`,
              updated_at: sql`now()::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
            } as any),
          )
          .execute();

        await logAuditEvent({
          actionType: "CREATE",
          tableName: "prescriptions",
          rowId: prescriptionId,
          changes: { ...input, id: prescriptionId },
          userId: ctx.userId,
        });

        return { prescription_id: prescriptionId };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to create prescription",
        });
      }
    }),

  /** Update mutable fields on an existing prescription. Only provided fields are changed. */
  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        filled_by: z.string().nullish(),
        pickup_clinic_id: z.string().nullish(),
        priority: z.string().nullish(),
        expiration_date: flexTimestampOptional,
        filled_at: flexTimestampOptional,
        status: z.string().nullish(),
        items: z.string().nullish(),
        notes: z.string().nullish(),
        metadata: z.string().nullish(),
        updated_at: flexTimestampOptional,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, updated_at: _updated_at, ...fields } = input;
        const updateSet: Record<string, unknown> = {};

        if (fields.filled_by !== undefined)
          updateSet.filled_by = fields.filled_by;
        if (fields.pickup_clinic_id !== undefined)
          updateSet.pickup_clinic_id = fields.pickup_clinic_id;
        if (fields.priority !== undefined)
          updateSet.priority = fields.priority;
        if (fields.expiration_date !== undefined && fields.expiration_date !== null)
          updateSet.expiration_date = toSqlTimestamp(fields.expiration_date);
        if (fields.filled_at !== undefined && fields.filled_at !== null)
          updateSet.filled_at = toSqlTimestamp(fields.filled_at);
        if (fields.status !== undefined)
          updateSet.status = fields.status;
        if (fields.items !== undefined && fields.items !== null)
          updateSet.items = sql`${fields.items}::jsonb`;
        if (fields.notes !== undefined)
          updateSet.notes = fields.notes;
        if (fields.metadata !== undefined && fields.metadata !== null)
          updateSet.metadata = sql`${fields.metadata}::jsonb`;

        updateSet.updated_at = sql`now()::timestamp with time zone`;
        updateSet.last_modified = sql`now()::timestamp with time zone`;

        await db
          .updateTable(Prescription.Table.name)
          .set(updateSet)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();

        const prescription = await db
          .selectFrom(Prescription.Table.name)
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        if (!prescription) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Prescription '${id}' not found`,
          });
        }

        await logAuditEvent({
          actionType: "UPDATE",
          tableName: "prescriptions",
          rowId: id,
          changes: fields,
          userId: ctx.userId,
        });

        return prescription;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update prescription",
        });
      }
    }),

  /** Update only the status field of a prescription */
  update_status: authedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await db
          .updateTable(Prescription.Table.name)
          .set({
            status: input.status,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .execute();

        await logAuditEvent({
          actionType: "UPDATE",
          tableName: "prescriptions",
          rowId: input.id,
          changes: { status: input.status },
          userId: ctx.userId,
        });

        return { ok: true };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update prescription status",
        });
      }
    }),

  /** Mark a prescription as picked up by a provider */
  pickup: authedProcedure
    .input(
      z.object({
        id: z.string(),
        provider_id: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await db
          .updateTable(Prescription.Table.name)
          .set({
            status: "picked_up",
            filled_by: input.provider_id,
            filled_at: sql`now()::timestamp with time zone`,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .execute();

        await logAuditEvent({
          actionType: "UPDATE",
          tableName: "prescriptions",
          rowId: input.id,
          changes: { status: "picked_up", filled_by: input.provider_id },
          userId: ctx.userId,
        });

        return { ok: true };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to mark prescription as picked up",
        });
      }
    }),
});
