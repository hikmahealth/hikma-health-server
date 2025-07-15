import { createServerFileRoute } from "@tanstack/react-start/server";

export const ServerRoute = createServerFileRoute("/api/sync").methods({
  GET: async ({ request }) => {
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 200,
    });
  },
  POST: async ({ request }) => {
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 200,
    });
  },
});
