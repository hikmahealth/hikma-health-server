import { createTRPCRouter } from "./init";
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
