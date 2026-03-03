import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { commandAppRouter } from "@/integrations/trpc/router";
import { createTRPCContext } from "@/integrations/trpc/init";
import {
  createRateLimiter,
  getClientIp,
  tooManyRequestsResponse,
} from "@/lib/rate-limiter";

const rpcLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
});

function handler({ request }: { request: Request }) {
  const ip = getClientIp(request);
  const limit = rpcLimiter.check(ip);
  if (!limit.allowed) return tooManyRequestsResponse(limit.retryAfterMs);

  return fetchRequestHandler({
    req: request,
    router: commandAppRouter,
    endpoint: "/rpc/command",
    createContext: () => createTRPCContext(request),
  });
}

export const Route = createFileRoute("/rpc/command/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
