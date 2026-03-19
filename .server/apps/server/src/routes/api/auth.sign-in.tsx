import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import User from "@/models/user";
import Clinic from "@/models/clinic";
import {
  createRateLimiter,
  getClientIp,
  tooManyRequestsResponse,
} from "@/lib/rate-limiter";
import { minutesToMilliseconds } from "date-fns";

const authLimiter = createRateLimiter({
  windowMs: minutesToMilliseconds(15),
  maxRequests: 30,
});

export const Route = createFileRoute("/api/auth/sign-in")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);
        const limit = authLimiter.check(ip);
        if (!limit.allowed) return tooManyRequestsResponse(limit.retryAfterMs);

        const { email, password } = await request.json();

        try {
          const { user, token } = await User.signIn(email, password);
          console.log({ user, token });

          const clinic = user.clinic_id
            ? await Clinic.getById(user.clinic_id)
            : null;

          setCookie("token", token, {
            httpOnly: true,
            secure: import.meta.env.DEV ? false : true,
            sameSite: "strict",
            path: "/",
            expires: new Date(Date.now() + 2 * 60 * 60 * 1000),
          });

          return new Response(
            JSON.stringify({
              user: {
                ...user,
                hashed_password: "************",
                clinic_name: clinic?.name,
              },
              token,
            }),
            {
              headers: {
                "Content-Type": "application/json",
              },
              status: 200,
            },
          );
        } catch (error) {
          console.error("[sign-in error]", error);
          return new Response(
            JSON.stringify({ error: "Invalid credentials" }),
            {
              headers: {
                "Content-Type": "application/json",
              },
              status: 401,
            },
          );
        }
      },
    },
  },
});
