import { deleteCookie, getCookie } from "@tanstack/react-start/server";
import { createFileRoute } from "@tanstack/react-router";
import Token from "@/models/token";

export const Route = createFileRoute("/api/auth/sign-out")({
  server: {
    handlers: {
      POST: async () => {
        // Get token from cookies
        const token = getCookie("token");

        if (!token) {
          return new Response(JSON.stringify({ error: "Not authenticated" }), {
            headers: {
              "Content-Type": "application/json",
            },
            status: 401,
          });
        }

        try {
          // Invalidate the token in the database
          await Token.invalidate(token);
          deleteCookie("token");

          return new Response(JSON.stringify({ success: true }), {
            headers: {
              "Content-Type": "application/json",
            },
            status: 200,
          });
        } catch (error) {
          console.error("Error during sign-out:", error);
          return new Response(JSON.stringify({ error: "Failed to sign out" }), {
            headers: {
              "Content-Type": "application/json",
            },
            status: 500,
          });
        }
      },
    },
  },
});
