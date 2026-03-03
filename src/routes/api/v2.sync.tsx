import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";
import User from "@/models/user";
import Sync from "@/models/sync";
import Device from "@/models/device";
import {
  createRateLimiter,
  getClientIp,
  tooManyRequestsResponse,
} from "@/lib/rate-limiter";

const syncLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
});

export const Route = createFileRoute("/api/v2/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ip = getClientIp(request);
        const limit = syncLimiter.check(ip);
        if (!limit.allowed) return tooManyRequestsResponse(limit.retryAfterMs);

        try {
          const { user, device } = await authenticateRequest(request);
          if (!user && !device) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              headers: { "Content-Type": "application/json" },
              status: 401,
            });
          }

          const url = new URL(request.url);
          const last_synced_at = Number(
            url.searchParams.get("last_pulled_at") ||
              url.searchParams.get("lastPulledAt") ||
              0,
          );
          const schemaVersion = url.searchParams.get("schemaVersion");
          const migration = url.searchParams.get("migration");
          const peerType: Device.DeviceTypeT =
            (url.searchParams.get("peerType") as Device.DeviceTypeT) ||
            "android"; // Get the peer type or else return "android"

          // Capture timestamp before running queries so the client's next sync
          // covers any records created/modified while these queries execute.
          const syncTimestamp = Date.now();

          const dbChangeSet = await Sync.getDeltaRecords(
            last_synced_at,
            peerType,
          );

          const changeSetSize = Object.values(dbChangeSet)
            .map(
              (entry) =>
                entry.created.length +
                entry.updated.length +
                entry.deleted.length,
            )
            .reduce((a, b) => a + b, 0);

          console.log({
            timestamp: syncTimestamp,
            dataPulled: changeSetSize,
          });

          return new Response(
            JSON.stringify({
              success: true,
              changes: dbChangeSet,
              timestamp: syncTimestamp,
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Internal server error";
          const isAuthError = message.includes("Unauthorized") ||
            message.includes("Authorization header") ||
            message.includes("Invalid credentials");
          return new Response(JSON.stringify({ error: message }), {
            headers: { "Content-Type": "application/json" },
            status: isAuthError ? 401 : 500,
          });
        }
      },
      POST: async ({ request }) => {
        const postIp = getClientIp(request);
        const postLimit = syncLimiter.check(postIp);
        if (!postLimit.allowed)
          return tooManyRequestsResponse(postLimit.retryAfterMs);

        try {
          const { user, device } = await authenticateRequest(request);
          if (!user && !device) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              headers: { "Content-Type": "application/json" },
              status: 401,
            });
          }

          const url = new URL(request.url);
          const last_synced_at = Number(
            url.searchParams.get("last_pulled_at") || 0,
          );
          const schemaVersion = url.searchParams.get("schemaVersion");
          const migration = url.searchParams.get("migration");

          // expected body structure
          // { [s in 'events' | 'patients' | ....]: { "created": Array<dict[str, any]>, "updated": Array<dict[str, any]>, deleted: []str }}
          const body = (await request.json()) as Sync.PushRequest;
          await Sync.persistClientChanges(body);

          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        } catch (error) {
          console.error(error);
          const message = error instanceof Error ? error.message : "Internal server error";
          const isAuthError = message.includes("Unauthorized") ||
            message.includes("Authorization header") ||
            message.includes("Invalid credentials");
          const isBadRequest = error instanceof SyntaxError; // JSON.parse failure
          const status = isAuthError ? 401 : isBadRequest ? 400 : 500;
          return new Response(JSON.stringify({ error: message }), {
            headers: { "Content-Type": "application/json" },
            status,
          });
        }
      },
    },
  },
});

const authenticateRequest = createServerOnlyFn(async (request: Request) => {
  const authHeader = request.headers.get("Authorization");
  const isBearerToken = authHeader?.startsWith("Bearer ");
  if (!authHeader || (!authHeader.startsWith("Basic ") && !isBearerToken)) {
    throw new Error("Authorization header missing or invalid");
  }

  const encodedCredentials = authHeader.split(" ")[1];

  let device;
  let user;

  if (isBearerToken) {
    // token is the secret API Key that we can validate with the server to make sure its valid.
    device = await Device.API.getByApiKey(encodedCredentials);
    console.log({ device, encodedCredentials });
  } else {
    const decodedCredentials = Buffer.from(
      encodedCredentials,
      "base64",
    ).toString();
    user = getAuthenticatedUserFromCredentials(decodedCredentials);
  }

  return {
    device,
    user,
  };
});

const getAuthenticatedUserFromCredentials = createServerOnlyFn(
  async (credentials: string) => {
    const [email, password] = credentials.split(":");
    if (!email || !password) {
      throw new Error("Invalid credentials format");
    }

    // Authenticate user with email and password
    const userResult = await User.signIn(email, password);
    if (!userResult) {
      throw new Error("Invalid credentials");
    }

    return userResult;
  },
);

// TODO: sync endpoint needs to support old mobile app.
