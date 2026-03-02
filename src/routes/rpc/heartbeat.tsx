import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/rpc/heartbeat")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
    },
  },
});
