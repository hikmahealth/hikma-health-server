/**
 * Prescription item command procedures (nested under `prescription_items.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import { flexTimestamp, flexTimestampOptional } from "@/lib/rpc-utils";

export const prescriptionItemsCommandRouter = createTRPCRouter({
  /**
   * Create a new prescription item (upsert).
   *
   * Implementation details:
   * - Upsert on id conflict
   * - Auto-generate id if omitted (uuidv7)
   * - metadata stored as JSONB
   * - Set server_created_at on insert, last_modified on both
   */
  create: authedProcedure
    .input(
      z.object({
        id: z.string().nullish(),
        prescription_id: z.string(),
        patient_id: z.string(),
        drug_id: z.string(),
        clinic_id: z.string(),
        dosage_instructions: z.string(),
        quantity_prescribed: z.number().int(),
        quantity_dispensed: z.number().int().nullish(),
        refills_authorized: z.number().int().nullish(),
        refills_used: z.number().int().nullish(),
        item_status: z.string().nullish(),
        notes: z.string().nullish(),
        metadata: z.string().nullish(),
        created_at: flexTimestamp,
        updated_at: flexTimestamp,
      }),
    )
    .mutation(async () => {
      // Phase 3: full implementation with upsert
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "prescription_items.create: not yet implemented",
      });
    }),

  /**
   * Update mutable fields on a prescription item.
   *
   * Implementation details:
   * - Only provided (non-undefined) fields are SET
   * - metadata is a JSONB column
   * - Returns full prescription item object after update
   */
  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        dosage_instructions: z.string().nullish(),
        quantity_prescribed: z.number().int().nullish(),
        quantity_dispensed: z.number().int().nullish(),
        refills_authorized: z.number().int().nullish(),
        refills_used: z.number().int().nullish(),
        item_status: z.string().nullish(),
        notes: z.string().nullish(),
        metadata: z.string().nullish(),
        updated_at: flexTimestampOptional,
      }),
    )
    .mutation(async () => {
      // Phase 3: full implementation
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "prescription_items.update: not yet implemented",
      });
    }),

  /**
   * Dispense a prescription item from one or more inventory batches.
   * Decrements inventory and increments quantity_dispensed.
   *
   * Implementation details (Phase 4 — high complexity):
   * - Runs in a single transaction for atomicity
   * - For each batch_id in batch_quantities:
   *   1. SELECT FOR UPDATE on clinic_inventory row to prevent races
   *   2. Assert quantity_available >= requested quantity
   *   3. Decrement quantity_available by the requested amount
   * - After all batches processed, increment prescription_items.quantity_dispensed
   *   by the total dispensed
   * - If any batch has insufficient stock, the entire transaction rolls back
   * - Returns { ok: true, total_dispensed: number }
   */
  dispense: authedProcedure
    .input(
      z.object({
        id: z.string(),
        provider_id: z.string(),
        batch_quantities: z.record(z.string(), z.number().int().positive()),
      }),
    )
    .mutation(async () => {
      // Phase 4: full implementation with multi-table transaction
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "prescription_items.dispense: not yet implemented",
      });
    }),
});
