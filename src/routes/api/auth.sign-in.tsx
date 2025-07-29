import { createServerFileRoute, setCookie } from "@tanstack/react-start/server";
import User from "@/models/user";

export const ServerRoute = createServerFileRoute("/api/auth/sign-in").methods({
  POST: async ({ request }) => {
    const { email, password } = await request.json();

    try {
      const { user, token } = await User.signIn(email, password);

      setCookie("token", token, {
        httpOnly: true,
        secure: import.meta.env.DEV ? false : true,
        sameSite: "strict",
        path: "/",
        expires: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });

      return new Response(
        JSON.stringify({
          user: { ...user, hashed_password: "************" },
          token,
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        }
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 401,
      });
    }
  },
});
