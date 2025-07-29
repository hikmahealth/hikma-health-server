/**
 * Routes to /v1/api/sync for older mobile applications that need to sync data.
 */

import { createServerFileRoute } from "@tanstack/react-start/server";

// export const Route = createFileRoute("/v1/api/sync")({
//   component: RouteComponent,
// });

export const ServerRoute = createServerFileRoute("/v1/api/sync").methods({
  GET: async ({ request }) => {
    // Forward the request to the /api/sync endpoint
    const apiSyncUrl = new URL("/api/sync", request.url);
    const forwardedRequest = new Request(apiSyncUrl, request);
    const response = await fetch(forwardedRequest);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: response.status,
    });
  },
  POST: async ({ request }) => {
    // Forward the request to the /api/sync endpoint
    const apiSyncUrl = new URL("/api/sync", request.url);
    const forwardedRequest = new Request(apiSyncUrl, request);
    const response = await fetch(forwardedRequest, {
      method: "POST",
      headers: forwardedRequest.headers,
      body: await forwardedRequest.text(),
    });
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: response.status,
    });
  },
});

// function RouteComponent() {
//   return <div>Hello "/v1/api/sync"!</div>;
// }
