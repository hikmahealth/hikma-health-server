import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  serverReducer,
  initialServerState,
  formatSyncResult,
  type ServerMachineState,
  type ServerPhase,
  type ServerAction,
} from "./server-state";

// ============================================================================
// serverReducer — unit tests
// ============================================================================

describe("serverReducer", () => {
  describe("START", () => {
    it("transitions to starting phase", () => {
      const next = serverReducer(initialServerState, { type: "START" });
      expect(next.phase).toBe("starting");
      expect(next.message).toBe("Starting server...");
      expect(next.error).toBeNull();
    });

    it("preserves address from previous state", () => {
      const state: ServerMachineState = {
        ...initialServerState,
        address: "192.168.1.1:4001",
      };
      const next = serverReducer(state, { type: "START" });
      expect(next.address).toBe("192.168.1.1:4001");
    });
  });

  describe("START_SUCCESS", () => {
    it("transitions to running with address and message", () => {
      const starting: ServerMachineState = {
        ...initialServerState,
        phase: "starting",
      };
      const next = serverReducer(starting, {
        type: "START_SUCCESS",
        address: "10.0.0.1:4001",
        message: "Server started",
      });
      expect(next.phase).toBe("running");
      expect(next.address).toBe("10.0.0.1:4001");
      expect(next.message).toBe("Server started");
      expect(next.error).toBeNull();
    });

    it("accepts null address", () => {
      const next = serverReducer(initialServerState, {
        type: "START_SUCCESS",
        address: null,
        message: "ok",
      });
      expect(next.phase).toBe("running");
      expect(next.address).toBeNull();
    });
  });

  describe("START_FAILURE", () => {
    it("transitions to error with message", () => {
      const next = serverReducer(initialServerState, {
        type: "START_FAILURE",
        error: "Port in use",
      });
      expect(next.phase).toBe("error");
      expect(next.error).toBe("Port in use");
      expect(next.message).toBeNull();
    });

    it("preserves address from previous state", () => {
      const state: ServerMachineState = {
        ...initialServerState,
        address: "old",
      };
      const next = serverReducer(state, {
        type: "START_FAILURE",
        error: "fail",
      });
      expect(next.address).toBe("old");
    });
  });

  describe("STOP", () => {
    it("transitions to stopping phase", () => {
      const running: ServerMachineState = {
        ...initialServerState,
        phase: "running",
        address: "10.0.0.1:4001",
      };
      const next = serverReducer(running, { type: "STOP" });
      expect(next.phase).toBe("stopping");
      expect(next.message).toBe("Stopping server...");
      expect(next.error).toBeNull();
      expect(next.address).toBe("10.0.0.1:4001");
    });
  });

  describe("STOP_SUCCESS", () => {
    it("transitions to idle, clears address", () => {
      const stopping: ServerMachineState = {
        ...initialServerState,
        phase: "stopping",
        address: "10.0.0.1:4001",
      };
      const next = serverReducer(stopping, { type: "STOP_SUCCESS" });
      expect(next.phase).toBe("idle");
      expect(next.address).toBeNull();
      expect(next.message).toBe("Server stopped");
      expect(next.error).toBeNull();
    });
  });

  describe("STOP_FAILURE", () => {
    it("transitions to error, clears address", () => {
      const next = serverReducer(initialServerState, {
        type: "STOP_FAILURE",
        error: "Shutdown timeout",
      });
      expect(next.phase).toBe("error");
      expect(next.address).toBeNull();
      expect(next.error).toBe("Shutdown timeout");
      expect(next.message).toBeNull();
    });
  });

  describe("STATUS_UPDATE", () => {
    it("updates phase to running when isRunning=true", () => {
      const next = serverReducer(initialServerState, {
        type: "STATUS_UPDATE",
        isRunning: true,
        address: "10.0.0.1:4001",
      });
      expect(next.phase).toBe("running");
      expect(next.address).toBe("10.0.0.1:4001");
    });

    it("updates phase to idle when isRunning=false", () => {
      const running: ServerMachineState = {
        ...initialServerState,
        phase: "running",
        address: "10.0.0.1:4001",
      };
      const next = serverReducer(running, {
        type: "STATUS_UPDATE",
        isRunning: false,
        address: null,
      });
      expect(next.phase).toBe("idle");
      expect(next.address).toBeNull();
    });

    it("preserves message and error", () => {
      const state: ServerMachineState = {
        phase: "idle",
        address: null,
        message: "previous message",
        error: "previous error",
      };
      const next = serverReducer(state, {
        type: "STATUS_UPDATE",
        isRunning: true,
        address: "addr",
      });
      expect(next.message).toBe("previous message");
      expect(next.error).toBe("previous error");
    });

    it("is ignored during 'starting' phase", () => {
      const starting: ServerMachineState = {
        ...initialServerState,
        phase: "starting",
      };
      const next = serverReducer(starting, {
        type: "STATUS_UPDATE",
        isRunning: false,
        address: null,
      });
      expect(next).toBe(starting); // exact same reference
    });

    it("is ignored during 'stopping' phase", () => {
      const stopping: ServerMachineState = {
        ...initialServerState,
        phase: "stopping",
      };
      const next = serverReducer(stopping, {
        type: "STATUS_UPDATE",
        isRunning: true,
        address: "10.0.0.1:4001",
      });
      expect(next).toBe(stopping);
    });
  });

  describe("CLEAR_ERROR", () => {
    it("clears error, preserves everything else", () => {
      const state: ServerMachineState = {
        phase: "error",
        address: "addr",
        message: "msg",
        error: "some error",
      };
      const next = serverReducer(state, { type: "CLEAR_ERROR" });
      expect(next.error).toBeNull();
      expect(next.phase).toBe("error");
      expect(next.address).toBe("addr");
      expect(next.message).toBe("msg");
    });
  });
});

// ============================================================================
// serverReducer — property-based tests
// ============================================================================

const arbPhase = fc.constantFrom<ServerPhase>(
  "idle",
  "starting",
  "running",
  "stopping",
  "error",
);

const arbState: fc.Arbitrary<ServerMachineState> = fc.record({
  phase: arbPhase,
  address: fc.option(fc.string(), { nil: null }),
  message: fc.option(fc.string(), { nil: null }),
  error: fc.option(fc.string(), { nil: null }),
});

const arbAction: fc.Arbitrary<ServerAction> = fc.oneof(
  fc.constant({ type: "START" as const }),
  fc.record({
    type: fc.constant("START_SUCCESS" as const),
    address: fc.option(fc.string(), { nil: null }),
    message: fc.string(),
  }),
  fc.record({
    type: fc.constant("START_FAILURE" as const),
    error: fc.string(),
  }),
  fc.constant({ type: "STOP" as const }),
  fc.constant({ type: "STOP_SUCCESS" as const }),
  fc.record({
    type: fc.constant("STOP_FAILURE" as const),
    error: fc.string(),
  }),
  fc.record({
    type: fc.constant("STATUS_UPDATE" as const),
    isRunning: fc.boolean(),
    address: fc.option(fc.string(), { nil: null }),
  }),
  fc.constant({ type: "CLEAR_ERROR" as const }),
);

const VALID_PHASES: readonly ServerPhase[] = [
  "idle",
  "starting",
  "running",
  "stopping",
  "error",
];

describe("serverReducer properties", () => {
  it("always returns a valid ServerPhase", () => {
    fc.assert(
      fc.property(arbState, arbAction, (state, action) => {
        const next = serverReducer(state, action);
        expect(VALID_PHASES).toContain(next.phase);
      }),
    );
  });

  it("never loses the phase field", () => {
    fc.assert(
      fc.property(arbState, arbAction, (state, action) => {
        const next = serverReducer(state, action);
        expect(next.phase).toBeDefined();
        expect(typeof next.phase).toBe("string");
      }),
    );
  });

  it("STATUS_UPDATE never changes transitional states", () => {
    fc.assert(
      fc.property(
        arbState,
        fc.boolean(),
        fc.option(fc.string(), { nil: null }),
        (state, isRunning, address) => {
          if (state.phase === "starting" || state.phase === "stopping") {
            const next = serverReducer(state, {
              type: "STATUS_UPDATE",
              isRunning,
              address,
            });
            expect(next).toBe(state);
          }
        },
      ),
    );
  });

  it("CLEAR_ERROR never changes phase", () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const next = serverReducer(state, { type: "CLEAR_ERROR" });
        expect(next.phase).toBe(state.phase);
      }),
    );
  });

  it("applying N actions in sequence never crashes", () => {
    fc.assert(
      fc.property(fc.array(arbAction, { maxLength: 50 }), (actions) => {
        let state = initialServerState;
        for (const action of actions) {
          state = serverReducer(state, action);
        }
        expect(VALID_PHASES).toContain(state.phase);
      }),
    );
  });
});

// ============================================================================
// formatSyncResult
// ============================================================================

describe("formatSyncResult", () => {
  it("sums pulled and pushed correctly", () => {
    const msg = formatSyncResult({
      pulled_created: 1,
      pulled_updated: 2,
      pulled_deleted: 3,
      pushed_created: 4,
      pushed_updated: 5,
      pushed_deleted: 6,
    });
    expect(msg).toBe("Synced: 6 pulled, 15 pushed");
  });

  it("handles all zeros", () => {
    const msg = formatSyncResult({
      pulled_created: 0,
      pulled_updated: 0,
      pulled_deleted: 0,
      pushed_created: 0,
      pushed_updated: 0,
      pushed_deleted: 0,
    });
    expect(msg).toBe("Synced: 0 pulled, 0 pushed");
  });

  it("sums are always non-negative for non-negative inputs", () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        fc.nat(),
        fc.nat(),
        fc.nat(),
        fc.nat(),
        (pc, pu, pd, sc, su, sd) => {
          const msg = formatSyncResult({
            pulled_created: pc,
            pulled_updated: pu,
            pulled_deleted: pd,
            pushed_created: sc,
            pushed_updated: su,
            pushed_deleted: sd,
          });
          const match = msg.match(/Synced: (\d+) pulled, (\d+) pushed/);
          expect(match).not.toBeNull();
          expect(Number(match![1])).toBe(pc + pu + pd);
          expect(Number(match![2])).toBe(sc + su + sd);
        },
      ),
    );
  });
});
