import { describe, it, expect } from "vitest";
import { commandAppRouter } from "@/integrations/trpc/router";

const createCaller = () =>
  commandAppRouter.createCaller({ authHeader: null });

describe("Command RPC procedures (integration)", () => {
  it("ping returns pong", async () => {
    const caller = createCaller();
    const result = await caller.ping();
    expect(result).toEqual({ pong: true });
  });

  it("login rejects invalid credentials", async () => {
    const caller = createCaller();
    await expect(
      caller.login({ email: "nonexistent@test.com", password: "wrong" }),
    ).rejects.toThrow();
  });
});
