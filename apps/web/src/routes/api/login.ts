/**
 * Routes to /api/login for older mobile applications that need to sign into the app.
 * All routes route to /api/auth/*
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiSignInUrl = new URL("/api/auth/sign-in", request.url);
        const forwardedRequest = new Request(apiSignInUrl, request);
        const response = await fetch(forwardedRequest);
        const { user, token } = await response.json();

        return new Response(JSON.stringify({ ...user, token }), {
          headers: { "Content-Type": "application/json" },
          status: response.status,
        });
      },
    },
  },
});
