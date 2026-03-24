/**
 * Sync push command procedure — delegates to existing Sync.persistClientChanges.
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

// The sync push payload is a record of table names to delta data.
// We use z.record with a loose schema since the Sync model validates internally.
const deltaDataSchema = z.object({
  created: z.array(z.record(z.string(), z.any())).optional().default([]),
  updated: z.array(z.record(z.string(), z.any())).optional().default([]),
  deleted: z.array(z.string()).optional().default([]),
});

export const syncCommandRouter = createTRPCRouter({
  /**
   * Push client changes to the server.
   * Delegates to Sync.persistClientChanges with the authenticated user context.
   *
   * Implementation details:
   * - Constructs a RequestCaller from the authenticated tRPC context
   * - Passes peerType as "unknown" (treated as mobile — safe default) unless specified
   * - The changes payload matches the REST POST /api/v2/sync body format
   * - Server-authoritative tables (users, registration_forms, event_forms) are silently skipped
   *   by Sync.persistClientChanges
   * - Returns empty object on success (matching hub spec)
   */
  push: authedProcedure
    .input(
      z.object({
        last_pulled_at: z.number().int().nonnegative(),
        changes: z.record(z.string(), deltaDataSchema),
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
    .mutation(async ({ input, ctx }) => {
      try {
        const caller = await callerFromContext(ctx);
        const peerType = (input.peer_type ?? "unknown") as any;
        await Sync.persistClientChanges(
          input.changes as any,
          peerType,
          caller,
        );
        return {};
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Sync push failed",
        });
      }
    }),
});
