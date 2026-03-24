/**
 * Education content query procedures (nested under `education.*` in the query router).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, publicProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import { sql } from "kysely";
import * as Sentry from "@sentry/tanstackstart-react";

export const educationQueryRouter = createTRPCRouter({
  /** List all education content for admin dashboard (authed). */
  list: authedProcedure.query(async () => {
    try {
      return await db
        .selectFrom("education_content")
        .selectAll()
        .where("is_deleted", "=", false)
        .orderBy("updated_at", "desc")
        .execute();
    } catch (error) {
      Sentry.captureException(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to list education content",
      });
    }
  }),

  /** Get a single content item by ID (authed, for editing). */
  get: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const row = await db
          .selectFrom("education_content")
          .selectAll()
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .executeTakeFirst();

        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Education content '${input.id}' not found`,
          });
        }

        return row;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get education content",
        });
      }
    }),

  /** List published + public content (public, for patient view). */
  list_public: publicProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      try {
        let query = db
          .selectFrom("education_content")
          .selectAll()
          .where("is_deleted", "=", false)
          .where("status", "=", "published")
          .where("visibility", "=", "public");

        const search = input?.search?.trim();
        if (search && search.length > 0) {
          // Escape SQL LIKE wildcards to prevent unintended pattern matching
          const escaped = search.toLowerCase().replace(/[%_\\]/g, "\\$&");
          const term = `%${escaped}%`;
          query = query.where(({ or, eb }) =>
            or([
              eb(sql`LOWER(title)`, "like", term),
              eb(sql`LOWER(description)`, "like", term),
            ]),
          );
        }

        return await query.orderBy("published_at", "desc").execute();
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to list public education content",
        });
      }
    }),

  /** Get a single published + public content item (public, for patient view). */
  get_public: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const row = await db
          .selectFrom("education_content")
          .selectAll()
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .where("status", "=", "published")
          .where("visibility", "=", "public")
          .executeTakeFirst();

        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Education content '${input.id}' not found`,
          });
        }

        return row;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get education content",
        });
      }
    }),
});
