/**
 * Sync pull query procedure — delegates to existing Sync.getDeltaRecords.
 *
 * The RPC caller is always an authenticated user (via JWT), not a device.
 * We construct a RequestCaller from the tRPC auth context.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure, createTRPCRouter } from "../../init";
import Sync from "@/models/sync";
import User from "@/models/user";
import Clinic from "@/models/clinic";
import { Option } from "@/lib/option";
import type { RequestCaller } from "@/types";
import type { AuthedContext } from "../../init";
import * as Sentry from "@sentry/tanstackstart-react";

/** Build a RequestCaller suitable for Sync methods from tRPC auth context */
async function callerFromContext(ctx: AuthedContext): Promise<RequestCaller> {
  // Load full user record for the caller
  const user = await User.API.getById(ctx.userId);
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  let clinic: Option<Clinic.EncodedT> = Option.none;
  if (user.clinic_id) {
    try {
      const c = await Clinic.getById(user.clinic_id);
      clinic = Option.some(c);
    } catch {
      // Clinic may not exist — proceed without it
    }
  }

  return { user, clinic, token: "" };
}

export const syncQueryRouter = createTRPCRouter({
  /**
   * Pull changes since last sync timestamp.
   * Delegates to Sync.getDeltaRecords with peerType inferred from context.
   *
   * Implementation details (Phase 4):
   * - Constructs a RequestCaller from the authenticated tRPC context
   * - Passes peerType as "unknown" (treated as mobile — safe default)
   * - Caller can optionally specify peerType to get hub-scoped results
   * - Returns { changes, timestamp } matching the REST /api/v2/sync GET response
   */
  pull: authedProcedure
    .input(
      z.object({
        last_pulled_at: z.number().int().nonnegative(),
        peer_type: z
          .enum([
            "android",
            "ios",
            "web",
            "desktop",
            "sync_hub",
            "laptop",
            "unknown",
          ])
          .optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const caller = await callerFromContext(ctx);
        const peerType = (input.peer_type ?? "unknown") as any;
        const syncTimestamp = Date.now();
        const changes = await Sync.getDeltaRecords(
          input.last_pulled_at,
          peerType,
          caller,
        );
        return { changes, timestamp: syncTimestamp };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Sync pull failed",
        });
      }
    }),
});
