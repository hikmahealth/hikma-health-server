/**
 * Appointment command procedures (nested under `appointments.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import Appointment from "@/models/appointment";
import db from "@/db";
import { sql } from "kysely";
import { flexTimestamp, flexTimestampOptional, toSqlTimestamp } from "@/lib/rpc-utils";
import { logAuditEvent } from "@/lib/server-functions/audit";
import { uuidv7 } from "uuidv7";
import * as Sentry from "@sentry/tanstackstart-react";

export const appointmentsCommandRouter = createTRPCRouter({
  /**
   * Create a new appointment (upsert on id conflict).
   * Uses direct DB queries rather than Appointment.API.save because the model's
   * save method is designed for the web UI flow (auto-creates visits, resolves
   * fallback UUIDs). Hub clients provide all IDs and timestamps directly.
   */
  create: authedProcedure
    .input(
      z.object({
        id: z.string().nullish(),
        provider_id: z.string().nullish(),
        clinic_id: z.string(),
        patient_id: z.string(),
        user_id: z.string(),
        current_visit_id: z.string(),
        fulfilled_visit_id: z.string().nullish(),
        timestamp: flexTimestamp,
        duration: z.number().nullish(),
        reason: z.string(),
        notes: z.string(),
        is_walk_in: z.number().int().min(0).max(1),
        departments: z.string(),
        status: z.string(),
        metadata: z.string(),
        created_at: flexTimestamp,
        updated_at: flexTimestamp,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const appointmentId = input.id ?? uuidv7();

        const insertValues = {
          id: appointmentId,
          provider_id: input.provider_id ?? null,
          clinic_id: input.clinic_id,
          patient_id: input.patient_id,
          user_id: input.user_id,
          current_visit_id: input.current_visit_id,
          fulfilled_visit_id: input.fulfilled_visit_id ?? null,
          timestamp: toSqlTimestamp(input.timestamp),
          duration: input.duration ?? 0,
          reason: input.reason,
          notes: input.notes,
          is_walk_in: !!input.is_walk_in,
          departments: sql`${input.departments}::jsonb`,
          status: input.status,
          metadata: sql`${input.metadata}::jsonb`,
          is_deleted: false,
          created_at: toSqlTimestamp(input.created_at),
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
          server_created_at: sql`now()::timestamp with time zone`,
          deleted_at: null,
        };

        await db
          .insertInto(Appointment.Table.name)
          .values(insertValues as any)
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              provider_id: input.provider_id ?? null,
              fulfilled_visit_id: input.fulfilled_visit_id ?? null,
              timestamp: toSqlTimestamp(input.timestamp),
              duration: input.duration ?? 0,
              reason: input.reason,
              notes: input.notes,
              is_walk_in: !!input.is_walk_in,
              departments: sql`${input.departments}::jsonb`,
              status: input.status,
              metadata: sql`${input.metadata}::jsonb`,
              updated_at: sql`now()::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
            } as any),
          )
          .execute();

        await logAuditEvent({
          actionType: "CREATE",
          tableName: "appointments",
          rowId: appointmentId,
          changes: { ...input, id: appointmentId },
          userId: ctx.userId,
        });

        return { appointment_id: appointmentId };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to create appointment",
        });
      }
    }),

  /** Update mutable fields on an existing appointment. Only provided fields are changed. */
  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        provider_id: z.string().nullish(),
        fulfilled_visit_id: z.string().nullish(),
        timestamp: flexTimestampOptional,
        duration: z.number().nullish(),
        reason: z.string().nullish(),
        notes: z.string().nullish(),
        is_walk_in: z.number().int().min(0).max(1).nullish(),
        departments: z.string().nullish(),
        status: z.string().nullish(),
        metadata: z.string().nullish(),
        updated_at: flexTimestampOptional,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, updated_at: _updated_at, ...fields } = input;
        const updateSet: Record<string, unknown> = {};

        if (fields.provider_id !== undefined)
          updateSet.provider_id = fields.provider_id;
        if (fields.fulfilled_visit_id !== undefined)
          updateSet.fulfilled_visit_id = fields.fulfilled_visit_id;
        if (fields.timestamp !== undefined && fields.timestamp !== null)
          updateSet.timestamp = toSqlTimestamp(fields.timestamp);
        if (fields.duration !== undefined)
          updateSet.duration = fields.duration;
        if (fields.reason !== undefined)
          updateSet.reason = fields.reason;
        if (fields.notes !== undefined)
          updateSet.notes = fields.notes;
        if (fields.is_walk_in !== undefined && fields.is_walk_in !== null)
          updateSet.is_walk_in = !!fields.is_walk_in;
        if (fields.departments !== undefined && fields.departments !== null)
          updateSet.departments = sql`${fields.departments}::jsonb`;
        if (fields.status !== undefined)
          updateSet.status = fields.status;
        if (fields.metadata !== undefined && fields.metadata !== null)
          updateSet.metadata = sql`${fields.metadata}::jsonb`;

        updateSet.updated_at = sql`now()::timestamp with time zone`;
        updateSet.last_modified = sql`now()::timestamp with time zone`;

        await db
          .updateTable(Appointment.Table.name)
          .set(updateSet)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();

        const appointment = await db
          .selectFrom(Appointment.Table.name)
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        if (!appointment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Appointment '${id}' not found`,
          });
        }

        await logAuditEvent({
          actionType: "UPDATE",
          tableName: "appointments",
          rowId: id,
          changes: fields,
          userId: ctx.userId,
        });

        return appointment;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update appointment",
        });
      }
    }),

  /** Soft-cancel an appointment by setting its status to "cancelled" */
  cancel: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db
          .updateTable(Appointment.Table.name)
          .set({
            status: "cancelled",
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .execute();

        await logAuditEvent({
          actionType: "UPDATE",
          tableName: "appointments",
          rowId: input.id,
          changes: { status: "cancelled" },
          userId: ctx.userId,
        });

        return { cancelled: true };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to cancel appointment",
        });
      }
    }),

  /** Mark an appointment as completed, optionally linking a visit */
  complete: authedProcedure
    .input(
      z.object({
        id: z.string(),
        user_id: z.string(),
        visit_id: z.string().nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const updateSet: Record<string, unknown> = {
          status: "completed",
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
        };

        if (input.visit_id) {
          updateSet.fulfilled_visit_id = input.visit_id;
        }

        await db
          .updateTable(Appointment.Table.name)
          .set(updateSet)
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .execute();

        await logAuditEvent({
          actionType: "UPDATE",
          tableName: "appointments",
          rowId: input.id,
          changes: {
            status: "completed",
            fulfilled_visit_id: input.visit_id,
          },
          userId: ctx.userId,
        });

        return { completed: true };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to complete appointment",
        });
      }
    }),
});
