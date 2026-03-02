import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { queryAppRouter } from "@/integrations/trpc/router";
import { createTRPCContext } from "@/integrations/trpc/init";

function handler({ request }: { request: Request }) {
  return fetchRequestHandler({
    req: request,
    router: queryAppRouter,
    endpoint: "/rpc/query",
    createContext: () => createTRPCContext(request),
  });
}

export const Route = createFileRoute("/rpc/query/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
