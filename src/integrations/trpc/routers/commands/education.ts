/**
 * Education content command procedures (nested under `education.*`).
 * Only admin and super_admin roles can manage education content.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import { sql } from "kysely";
import { logAuditEvent } from "@/lib/server-functions/audit";
import * as Sentry from "@sentry/tanstackstart-react";
import User from "@/models/user";

/** Guard: only admin or super_admin may proceed. */
function requireAdmin(role: string): void {
  if (role !== User.ROLES.ADMIN && role !== User.ROLES.SUPER_ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only admins can manage education content",
    });
  }
}

export const educationCommandRouter = createTRPCRouter({
  /** Create a new education content item. */
  create: authedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(512),
        description: z.string().nullish(),
        content_type: z.enum(["tiptap", "resource"]),
        tiptap_content: z.record(z.string(), z.unknown()).nullish(),
        resource_id: z.string().nullish(),
        status: z.enum(["draft", "published"]).default("draft"),
        visibility: z.enum(["public", "private"]).default("private"),
        language: z.string().default("en"),
        tags: z.array(z.string()).default([]),
        metadata: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.role);
      try {
        const row = await db
          .insertInto("education_content")
          .values({
            title: input.title,
            description: input.description ?? null,
            content_type: input.content_type,
            tiptap_content: input.tiptap_content ? JSON.stringify(input.tiptap_content) : null,
            resource_id: input.resource_id ?? null,
            status: input.status,
            visibility: input.visibility,
            language: input.language,
            tags: JSON.stringify(input.tags),
            metadata: JSON.stringify(input.metadata),
            author_id: ctx.userId,
            published_at: input.status === "published" ? new Date().toISOString() : null,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        await logAuditEvent({
          actionType: "CREATE",
          tableName: "education_content",
          rowId: row.id,
          changes: { title: input.title, content_type: input.content_type },
          userId: ctx.userId,
        });

        return row;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create education content",
        });
      }
    }),

  /** Update an existing education content item. */
  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(512).optional(),
        description: z.string().nullish(),
        content_type: z.enum(["tiptap", "resource"]).optional(),
        tiptap_content: z.record(z.string(), z.unknown()).nullish(),
        resource_id: z.string().nullish(),
        status: z.enum(["draft", "published"]).optional(),
        visibility: z.enum(["public", "private"]).optional(),
        language: z.string().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.role);
      try {
        const { id, ...fields } = input;

        // Build the update payload, only including provided fields
        const updateData: Record<string, unknown> = {
          updated_at: sql`now()`,
        };

        if (fields.title !== undefined) updateData.title = fields.title;
        if (fields.description !== undefined) updateData.description = fields.description;
        if (fields.content_type !== undefined) updateData.content_type = fields.content_type;
        if (fields.tiptap_content !== undefined) updateData.tiptap_content = fields.tiptap_content ? JSON.stringify(fields.tiptap_content) : null;
        if (fields.resource_id !== undefined) updateData.resource_id = fields.resource_id;
        if (fields.visibility !== undefined) updateData.visibility = fields.visibility;
        if (fields.language !== undefined) updateData.language = fields.language;
        if (fields.tags !== undefined) updateData.tags = JSON.stringify(fields.tags);
        if (fields.metadata !== undefined) updateData.metadata = JSON.stringify(fields.metadata);

        // Handle status changes — set published_at on first publish
        if (fields.status !== undefined) {
          updateData.status = fields.status;
          if (fields.status === "published") {
            const existing = await db
              .selectFrom("education_content")
              .select("published_at")
              .where("id", "=", id)
              .executeTakeFirst();
            if (!existing?.published_at) {
              updateData.published_at = new Date().toISOString();
            }
          }
        }

        const row = await db
          .updateTable("education_content")
          .set(updateData as any)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .returningAll()
          .executeTakeFirstOrThrow();

        await logAuditEvent({
          actionType: "UPDATE",
          tableName: "education_content",
          rowId: id,
          changes: fields,
          userId: ctx.userId,
        });

        return row;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update education content",
        });
      }
    }),

  /** Soft-delete an education content item. */
  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.role);
      try {
        await db
          .updateTable("education_content")
          .set({
            is_deleted: true,
            deleted_at: sql`now()`,
            updated_at: sql`now()`,
          })
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .execute();

        await logAuditEvent({
          actionType: "SOFT_DELETE",
          tableName: "education_content",
          rowId: input.id,
          changes: { soft_delete: true },
          userId: ctx.userId,
        });

        return { deleted: true, id: input.id };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete education content",
        });
      }
    }),
});
