import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import {
  TanStackRouterDevtools,
  TanStackRouterDevtoolsPanel,
} from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import Header from "../components/Header";

import TanStackQueryLayout from "../integrations/tanstack-query/layout.tsx";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

import type { AppRouter } from "@/integrations/trpc/router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { Toaster } from "@/components/ui/sonner.tsx";
import TanStackQueryProvider from "@/integrations/tanstack-query/root-provider";

interface MyRouterContext {
  queryClient: QueryClient;

  trpc: TRPCOptionsProxy<AppRouter>;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Hikma Health EHR",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: () => (
    <RootDocument>
      <TanStackQueryProvider>
        <Outlet />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            // StoreDevtools,
            // TanStackQueryDevtools,
          ]}
        />
        {/*<TanStackRouterDevtools />*/}

        <TanStackQueryLayout />
        <Toaster />
      </TanStackQueryProvider>
    </RootDocument>
  ),

  errorComponent: ({ error, reset }) => (
    <RootDocument>
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border p-6 text-center">
          <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
          {import.meta.env.DEV && (
            <pre className="mb-4 overflow-auto rounded bg-muted p-2 text-left text-xs">
              {error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </RootDocument>
  ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
