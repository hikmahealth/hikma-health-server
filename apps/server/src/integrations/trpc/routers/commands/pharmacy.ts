/**
 * Dispensing command procedures (nested under `dispensing.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import { flexTimestamp, flexTimestampOptional } from "@/lib/rpc-utils";

export const dispensingCommandRouter = createTRPCRouter({
  /**
   * Record a dispensing event (medication given to a patient).
   *
   * Implementation details:
   * - Upsert on id conflict
   * - Auto-generate id if omitted (uuidv7)
   * - metadata stored as JSONB
   * - dispensed_at is a flex timestamp
   * - Set server_created_at on insert, last_modified on both
   * - Does NOT decrement inventory — that's prescription_items.dispense's job.
   *   This is a standalone dispensing record (e.g. OTC or walk-in dispensing).
   */
  create: authedProcedure
    .input(
      z.object({
        id: z.string().nullish(),
        clinic_id: z.string(),
        drug_id: z.string(),
        batch_id: z.string().nullish(),
        prescription_item_id: z.string().nullish(),
        patient_id: z.string(),
        quantity_dispensed: z.number().int(),
        dosage_instructions: z.string().nullish(),
        days_supply: z.number().int().nullish(),
        dispensed_by: z.string(),
        dispensed_at: flexTimestamp,
        metadata: z.string().nullish(),
        created_at: flexTimestampOptional,
        updated_at: flexTimestampOptional,
      }),
    )
    .mutation(async () => {
      // Phase 3: full implementation with upsert
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "dispensing.create: not yet implemented",
      });
    }),
});
