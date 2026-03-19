import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import { createTRPCClient, httpBatchStreamLink, splitLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { TRPCProvider } from "@/integrations/trpc/react";

import type { AppRouter } from "@/integrations/trpc/router";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "query",
      true: httpBatchStreamLink({
        transformer: superjson,
        url: `${getBaseUrl()}/rpc/query`,
      }),
      false: httpBatchStreamLink({
        transformer: superjson,
        url: `${getBaseUrl()}/rpc/command`,
      }),
    }),
  ],
});

let context:
  | {
      queryClient: QueryClient;
      trpc: ReturnType<typeof createTRPCOptionsProxy<AppRouter>>;
    }
  | undefined;

export function getContext() {
  if (context) return context;

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: { serializeData: superjson.serialize },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });

  const serverHelpers = createTRPCOptionsProxy({
    client: trpcClient,
    queryClient,
  });

  context = { queryClient, trpc: serverHelpers };
  return context;
}

export default function TanStackQueryProvider({
  children,
}: { children: ReactNode }) {
  const { queryClient } = getContext();

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
