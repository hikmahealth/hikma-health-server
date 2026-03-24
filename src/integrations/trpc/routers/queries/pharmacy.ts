/**
 * Drug catalogue, inventory, and dispensing query procedures.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import db from "@/db";
import { sql } from "kysely";
import * as Sentry from "@sentry/tanstackstart-react";

export const drugsQueryRouter = createTRPCRouter({
  /** Retrieve a single drug by ID */
  get: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const row = await db
          .selectFrom("drug_catalogue")
          .selectAll()
          .where("id", "=", input.id)
          .where("is_deleted", "=", false)
          .executeTakeFirst();
        return row ?? null;
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch drug",
        });
      }
    }),

  /** Retrieve a drug by its barcode */
  by_barcode: authedProcedure
    .input(z.object({ barcode: z.string() }))
    .query(async ({ input }) => {
      try {
        const row = await db
          .selectFrom("drug_catalogue")
          .selectAll()
          .where("barcode", "=", input.barcode)
          .where("is_deleted", "=", false)
          .executeTakeFirst();
        return row ?? null;
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch drug by barcode",
        });
      }
    }),

  /**
   * Search the drug catalogue with optional filters.
   * Uses direct DB queries rather than DrugCatalogue.API.search because the
   * model's search is Effect-based, requires a non-empty search_term, and
   * doesn't support form/route/is_active filters that the hub RPC spec needs.
   */
  search: authedProcedure
    .input(
      z.object({
        search_term: z.string().nullish(),
        form: z.string().nullish(),
        route: z.string().nullish(),
        is_active: z.boolean().nullish(),
      }),
    )
    .query(async ({ input }) => {
      try {
        let query = db
          .selectFrom("drug_catalogue")
          .selectAll()
          .where("is_deleted", "=", false);

        if (input.search_term) {
          const term = `%${input.search_term}%`;
          query = query.where(({ or, eb }) =>
            or([
              eb("generic_name", "ilike", term),
              eb("brand_name", "ilike", term),
              eb("barcode", "ilike", term),
            ]),
          );
        }

        if (input.form) {
          query = query.where("form", "=", input.form);
        }
        if (input.route) {
          query = query.where("route", "=", input.route);
        }
        if (input.is_active != null) {
          query = query.where("is_active", "=", input.is_active);
        }

        const data = await query.orderBy("generic_name", "asc").execute();
        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to search drugs",
        });
      }
    }),
});

export const inventoryQueryRouter = createTRPCRouter({
  /** Retrieve all inventory records for a clinic */
  by_clinic: authedProcedure
    .input(z.object({ clinic_id: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await db
          .selectFrom("clinic_inventory")
          .selectAll()
          .where("clinic_id", "=", input.clinic_id)
          .where("is_deleted", "=", false)
          .orderBy("updated_at", "desc")
          .execute();
        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch clinic inventory",
        });
      }
    }),

  /** Check whether a drug has sufficient stock at a clinic */
  check_availability: authedProcedure
    .input(
      z.object({
        drug_id: z.string(),
        clinic_id: z.string(),
        required_quantity: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await db
          .selectFrom("clinic_inventory")
          .select(
            sql<number>`COALESCE(SUM(quantity_available - reserved_quantity), 0)`.as(
              "total_available",
            ),
          )
          .where("drug_id", "=", input.drug_id)
          .where("clinic_id", "=", input.clinic_id)
          .where("is_deleted", "=", false)
          .executeTakeFirst();

        const totalAvailable = Number(result?.total_available ?? 0);
        return {
          available: totalAvailable >= input.required_quantity,
          total_available: totalAvailable,
        };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to check inventory availability",
        });
      }
    }),

  /**
   * Search inventory within a clinic by drug name or batch number.
   * Uses direct DB queries rather than ClinicInventory.getWithDrugInfo because
   * the model method returns an aggregated DrugWithBatchInfo shape (grouped by
   * drug with batch arrays), while the hub RPC spec expects flat inventory rows.
   */
  search: authedProcedure
    .input(
      z.object({
        clinic_id: z.string(),
        search_term: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const term = `%${input.search_term}%`;

        // Join with drug_catalogue to enable search by drug name
        const data = await db
          .selectFrom("clinic_inventory as ci")
          .innerJoin("drug_catalogue as dc", "dc.id", "ci.drug_id")
          .selectAll("ci")
          .where("ci.clinic_id", "=", input.clinic_id)
          .where("ci.is_deleted", "=", false)
          .where(({ or, eb }) =>
            or([
              eb("dc.generic_name", "ilike", term),
              eb("dc.brand_name", "ilike", term),
              eb("ci.batch_number", "ilike", term),
            ]),
          )
          .orderBy("ci.updated_at", "desc")
          .execute();

        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to search inventory",
        });
      }
    }),
});

export const dispensingQueryRouter = createTRPCRouter({
  /** Retrieve all dispensing records for a patient */
  by_patient: authedProcedure
    .input(z.object({ patient_id: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await db
          .selectFrom("dispensing_records")
          .selectAll()
          .where("patient_id", "=", input.patient_id)
          .where("is_deleted", "=", false)
          .orderBy("dispensed_at", "desc")
          .execute();
        return { data };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch dispensing records",
        });
      }
    }),
});
