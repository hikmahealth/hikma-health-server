import { createFileRoute } from "@tanstack/react-router";
import Device from "@/models/device";

export const Route = createFileRoute("/api/hub/verify-key")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { api_key } = await request.json();
          console.log({ api_key });

          if (!api_key || typeof api_key !== "string") {
            return new Response(
              JSON.stringify({ error: "Missing or invalid api_key" }),
              {
                headers: { "Content-Type": "application/json" },
                status: 400,
              },
            );
          }

          const device = await Device.API.getByApiKey(api_key);

          console.log({ device });

          if (!device) {
            return new Response(JSON.stringify({ error: "Invalid API key" }), {
              headers: { "Content-Type": "application/json" },
              status: 401,
            });
          }

          // Strip the api_key_hash from the response
          const { api_key_hash, ...deviceData } = device;

          return new Response(JSON.stringify(deviceData), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        } catch (error) {
          console.error("Error verifying device API key:", error);
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
              headers: { "Content-Type": "application/json" },
              status: 500,
            },
          );
        }
      },
    },
  },
});
