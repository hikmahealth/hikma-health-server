import { createTRPCRouter, createCallerFactory } from "./init";
import { queryProcedures } from "./routers/queries";
import { commandProcedures } from "./routers/commands";

/** Query-only router served at /rpc/query */
export const queryAppRouter = createTRPCRouter(queryProcedures);

/** Command-only router served at /rpc/command */
export const commandAppRouter = createTRPCRouter(commandProcedures);

/** Merged router for client-side type inference (never served directly) */
const appRouter = createTRPCRouter({
  ...queryProcedures,
  ...commandProcedures,
});

export type AppRouter = typeof appRouter;

/**
 * Server-side caller for invoking tRPC procedures directly (e.g. from createServerFn).
 * Pass a TRPCContext with the auth header to get full middleware processing.
 */
export const createServerCaller = createCallerFactory(commandAppRouter);
