import { describe, it, expect } from "vitest";
import { queryAppRouter } from "@/integrations/trpc/router";

const createCaller = () =>
  queryAppRouter.createCaller({ authHeader: null });

describe("Query RPC procedures (integration)", () => {
  it("ping returns pong", async () => {
    const caller = createCaller();
    const result = await caller.ping();
    expect(result).toEqual({ pong: true });
  });

  it("heartbeat returns status ok", async () => {
    const caller = createCaller();
    const result = await caller.heartbeat();
    expect(result).toHaveProperty("status", "ok");
  });
});
