import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Logger } from "@hikmahealth/js-utils";
import reports from "./routes/reports.js";
import { auth_middleware } from "../src/clients.js";

const app = new Hono();

// Health/status endpoints are public
app.get("/", (c) => c.json({ message: "hello hh-ai-service" }));
app.get("/health", (c) => c.json({ status: "ok" }));

// All /reports routes require a valid API key
app.use("/reports/*", auth_middleware);
app.route("/reports", reports);

const port = Number(process.env.PORT) || 3003;

Logger.info(`Server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
