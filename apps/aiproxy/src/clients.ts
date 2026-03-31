import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Context, Next } from "hono";

type client_status = "Active" | "Paused" | "Inactive" | "Blocked";

export type client = {
  key: string;
  name: string;
  status: client_status;
  exempt_ai_api_key: boolean;
  created_at: Date;
  updated_at: Date;
};

type client_json = Omit<client, "created_at" | "updated_at"> & {
  created_at: string;
  updated_at: string;
};

function load_clients(): client[] {
  // Resolve from project root (two levels up from src/)
  const project_root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const file_path = resolve(project_root, "clients_list.json");

  if (!existsSync(file_path)) {
    console.warn(`[clients] WARNING: ${file_path} not found — no clients registered`);
    return [];
  }

  const raw: client_json[] = JSON.parse(readFileSync(file_path, "utf-8"));
  return raw.map((c) => ({
    ...c,
    created_at: new Date(c.created_at),
    updated_at: new Date(c.updated_at),
  }));
}

const clients: client[] = load_clients();

function find_client(api_key: string): client | undefined {
  return clients.find((c) => c.key === api_key);
}

/** Hono middleware that validates the x-api-key header against the client registry. */
export async function auth_middleware(c: Context, next: Next) {
  const api_key = c.req.header("x-api-key");

  if (!api_key) {
    return c.json({ error: "Missing x-api-key header" }, 401);
  }

  const client = find_client(api_key);

  if (!client) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  if (client.status !== "Active") {
    return c.json(
      { error: `Client "${client.name}" is ${client.status.toLowerCase()}` },
      403,
    );
  }

  c.set("client", client);
  await next();
}

/** Resolves the Anthropic API key based on the client's exempt_ai_api_key flag.
 *  - exempt=true: always use our server key, ignore whatever the client sends
 *  - exempt=false: client must provide their own key */
export function resolve_ai_api_key(
  client_record: client,
  request_key: string | undefined,
): { ok: true; key: string } | { ok: false; error: string } {
  if (client_record.exempt_ai_api_key) {
    const server_key = process.env["ANTHROPIC_API_KEY"];
    if (!server_key) {
      return { ok: false, error: "Server Anthropic API key not configured" };
    }
    return { ok: true, key: server_key };
  }

  if (!request_key) {
    return { ok: false, error: "ai_api_key is required" };
  }

  return { ok: true, key: request_key };
}
