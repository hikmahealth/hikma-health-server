/**
 * Audit logging helpers for server functions.
 * Provides a lightweight way to get request context and log events
 * from within createServerFn handlers.
 */

import { getHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import * as Sentry from "@sentry/tanstackstart-react";
import db from "@/db";
import EventLog from "@/models/event-logs";

/**
 * Build an EventLog.RequestContext from the current server function request.
 * Uses TanStack's getHeader() which works inside createServerFn handlers.
 */
export function getWebRequestContext(): EventLog.RequestContext {
  let ipAddress: string | null = null;
  let deviceId = "unknown";

  try {
    const forwarded = getHeader("x-forwarded-for");
    ipAddress =
      typeof forwarded === "string"
        ? forwarded.split(",")[0]?.trim() ?? null
        : null;

    const userAgent = getHeader("user-agent") ?? "unknown";
    deviceId = createHash("sha256").update(userAgent).digest("hex");
  } catch {
    // getHeader may throw if called outside a request context (e.g. in tests)
  }

  return {
    ipAddress,
    deviceId,
    appId: "web",
  };
}

/**
 * Log a single audit event using the shared db instance and web request context.
 * Fire-and-forget — errors are caught and logged, never thrown to the caller.
 */
export async function logAuditEvent(
  params: EventLog.LogEventParams,
): Promise<void> {
  try {
    const ctx = getWebRequestContext();
    await EventLog.logEvent(db, params, ctx);
  } catch (error) {
    // Audit logging should never break the primary operation
    Sentry.captureException(error, { tags: { subsystem: "audit" } });
    console.error("Audit log failed:", error);
  }
}
