import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createMCPServer } from "./mcp.js";

const app = new Hono();
app.use(logger());

// Enable CORS for all origins
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "mcp-session-id",
      "Last-Event-ID",
      "mcp-protocol-version",
    ],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }),
);
app.get("/health", (c) => c.json({ status: "ok" }));
const PORT = process.env.SERVER_PORT
  ? parseInt(process.env.SERVER_PORT, 10)
  : 3000;

const transport = new WebStandardStreamableHTTPServerTransport();
app.all("/mcp", (c) => transport.handleRequest(c.req.raw));

app.post(
  "/query",
  zValidator(
    "form",
    z.object({
      query: z.string(),
    }),
  ),
  async function (c) {
    const { query } = c.req.valid("form");
    console.error(query);
    return c.json({
      ok: true,
    });
  },
);

const server = createMCPServer();
serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  async (info) => {
    await server.connect(transport); // for querying
    // When build MCPs, use console.error instead of console.log
    // Should change to an appropriate logger for this
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
