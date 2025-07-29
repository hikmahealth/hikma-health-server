/**
 * Routes to /api/login for older mobile applications that need to sign into the app.
 * All routes route to /api/auth/*
 */

import { createServerFileRoute } from "@tanstack/react-start/server";

// export const Route = createFileRoute("/v1/api/sync")({
//   component: RouteComponent,
// });

export const ServerRoute = createServerFileRoute("/api/login").methods({
  POST: async ({ request }) => {
    // Forward the request to the /api/auth/sign-in endpoint
    const apiSignInUrl = new URL("/api/auth/sign-in", request.url);
    const forwardedRequest = new Request(apiSignInUrl, request);
    const response = await fetch(forwardedRequest);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: response.status,
    });
  },
});
