import { createServerFn } from "@tanstack/react-start";
import Event from "@/models/event";
import { userRoleTokenHasCapability } from "../auth/request";
import User from "@/models/user";
import * as Sentry from "@sentry/tanstackstart-react";
import { permissionsMiddleware } from "@/middleware/auth";
import db from "@/db";
import { sql } from "kysely";
import {
  type CreateEventInput,
  type UpdateEventInput,
  buildEventInsertValues,
} from "./builders";
import { logAuditEvent } from "./audit";
import { Result } from "@/lib/result";

/**
 * Get all events by form id with pagination
 * @returns {Promise<{ events: Event.EncodedT[], pagination: { total: number, offset: number, limit: number, hasMore: boolean } }>} - The list of events and pagination info
 */
export const getEventsByFormId = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { form_id: string; limit?: number; offset?: number }) => data,
  )
  .handler(
    async ({
      data,
    }): Promise<{
      events: Event.EncodedT[];
      pagination: {
        total: number;
        offset: number;
        limit: number;
        hasMore: boolean;
      };
    }> => {
      const limit = data.limit || 50;
      const offset = data.offset || 0;
      const result = await Event.API.getAllByFormId(data.form_id, {
        limit,
        offset,
        includeCount: true,
      });

      return {
        events: result.events,
        pagination: {
          total: result.total,
          offset,
          limit,
          hasMore: offset + result.events.length < result.total,
        },
      };
    },
  );

/**
 * Get all non-deleted events for a visit, ordered by most recent first.
 * This is an online-mode endpoint — the existing sync system continues to work independently.
 * @returns Array of events belonging to the visit
 */
export const getVisitEvents = createServerFn({ method: "GET" })
  .inputValidator((data: { visitId: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<
      Result<{
        items: Event.EncodedT[];
      }>
    > => {
      const authorized = await userRoleTokenHasCapability([
        User.CAPABILITIES.READ_ALL_PATIENT,
      ]);

      if (!authorized) {
        return Promise.reject({
          message: "Unauthorized: Insufficient permissions",
          source: "getVisitEvents",
        });
      }

      try {
        const items = await Event.API.getByVisitId(data.visitId);
        return Result.ok({ items });
      } catch (error) {
        Sentry.captureException(error);
        return Result.err({
          _tag: "ServerError" as const,
          message:
            error instanceof Error ? error.message : "Failed to fetch events",
        });
      }
    },
  );

/**
 * Create a new event within an existing visit. The visitId is required — the client
 * must create a visit first before adding events to it.
 * This is an online-mode endpoint — the existing sync system continues to work independently.
 * @returns The new event ID on success
 */
export const createEvent = createServerFn({ method: "POST" })
  .inputValidator((data: CreateEventInput) => data)
  .middleware([permissionsMiddleware])
  .handler(
    async ({
      data,
      context,
    }): Promise<
      { success: true; id: string } | { success: false; error: string }
    > => {
      if (!context.userId) {
        return Promise.reject({
          message: "Unauthorized",
          source: "createEvent",
        });
      }

      return Sentry.startSpan({ name: "createEvent" }, async () => {
        try {
          const values = buildEventInsertValues(data, {
            recordedByUserId: context.userId,
          });
          const eventId = values.id;

          await db
            .insertInto(Event.Table.name)
            .values({
              id: values.id,
              patient_id: values.patient_id,
              visit_id: values.visit_id,
              form_id: values.form_id,
              event_type: values.event_type,
              form_data: sql`${JSON.stringify(values.form_data)}::jsonb`,
              metadata: sql`${JSON.stringify(values.metadata)}::jsonb`,
              recorded_by_user_id: values.recorded_by_user_id,
              is_deleted: false,
              created_at: sql`now()::timestamp with time zone`,
              updated_at: sql`now()::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
              server_created_at: sql`now()::timestamp with time zone`,
              deleted_at: null,
            })
            .executeTakeFirstOrThrow();

          await logAuditEvent({
            actionType: "CREATE",
            tableName: "events",
            rowId: eventId,
            changes: { ...data, recorded_by_user_id: context.userId },
            userId: context.userId,
          });

          return { success: true as const, id: eventId };
        } catch (error) {
          Sentry.captureException(error);
          return {
            success: false as const,
            error:
              error instanceof Error ? error.message : "Failed to create event",
          };
        }
      });
    },
  );

/**
 * Update the form data and optionally metadata for an existing event.
 * Only form_data and metadata fields are updated — all other fields remain unchanged.
 * This is an online-mode endpoint — the existing sync system continues to work independently.
 * @returns Success status
 */
export const updateEvent = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateEventInput) => data)
  .middleware([permissionsMiddleware])
  .handler(
    async ({
      data,
      context,
    }): Promise<{ success: true } | { success: false; error: string }> => {
      if (!context.userId) {
        return Promise.reject({
          message: "Unauthorized",
          source: "updateEvent",
        });
      }

      return Sentry.startSpan({ name: "updateEvent" }, async () => {
        try {
          await Event.API.updateFormData(data.id, data.formData, data.metadata);

          await logAuditEvent({
            actionType: "UPDATE",
            tableName: "events",
            rowId: data.id,
            changes: { formData: data.formData, metadata: data.metadata },
            userId: context.userId,
          });

          return { success: true as const };
        } catch (error) {
          Sentry.captureException(error);
          return {
            success: false as const,
            error:
              error instanceof Error ? error.message : "Failed to update event",
          };
        }
      });
    },
  );
