import { createServerFileRoute } from "@tanstack/react-start/server";
import User from "@/models/user";
import Sync from "@/models/sync";
import { serverOnly } from "@tanstack/react-start";

export const ServerRoute = createServerFileRoute("/api/v2/sync").methods({
  GET: async ({ request }) => {
    try {
      const user = await getAuthenticatedUserFromRequest(request);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          headers: { "Content-Type": "application/json" },
          status: 401,
        });
      }

      const url = new URL(request.url);
      const last_synced_at = Number(
        url.searchParams.get("last_pulled_at") || 0
      );
      const schemaVersion = url.searchParams.get("schemaVersion");
      const migration = url.searchParams.get("migration");

      const dbChangeSet = await Sync.getDeltaRecords(last_synced_at);

      console.log({
        timestamp: Date.now(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          changes: dbChangeSet,
          timestamp: Date.now(),
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { "Content-Type": "application/json" },
        status: 401,
      });
    }
  },
  POST: async ({ request }) => {
    try {
      const user = await getAuthenticatedUserFromRequest(request);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          headers: { "Content-Type": "application/json" },
          status: 401,
        });
      }

      const url = new URL(request.url);
      const last_synced_at = Number(
        url.searchParams.get("last_pulled_at") || 0
      );
      const schemaVersion = url.searchParams.get("schemaVersion");
      const migration = url.searchParams.get("migration");

      // expected body structure
      // { [s in 'events' | 'patients' | ....]: { "created": Array<dict[str, any]>, "updated": Array<dict[str, any]>, deleted: []str }}
      const body = (await request.json()) as Sync.PushRequest;
      console.log(body);
      await Sync.persistClientChanges(body);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { "Content-Type": "application/json" },
        status: 401,
      });
    }
  },
});

const getAuthenticatedUserFromRequest = serverOnly(async (request: Request) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    throw new Error("Authorization header missing or invalid");
  }

  const encodedCredentials = authHeader.split(" ")[1];
  const decodedCredentials = Buffer.from(
    encodedCredentials,
    "base64"
  ).toString();

  const [email, password] = decodedCredentials.split(":");
  if (!email || !password) {
    throw new Error("Invalid credentials format");
  }

  // Authenticate user with email and password
  const userResult = await User.signIn(email, password);
  if (!userResult) {
    throw new Error("Invalid credentials");
  }

  return userResult;
});

// TODO: sync endpoint needs to support old mobile app.
