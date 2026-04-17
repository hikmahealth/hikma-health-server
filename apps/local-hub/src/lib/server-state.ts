// Server lifecycle state machine.
//
// Pure reducer + types — no React, no side effects.

export type ServerPhase = "idle" | "starting" | "running" | "stopping" | "error";

export type ServerMachineState = {
  phase: ServerPhase;
  address: string | null;
  message: string | null;
  error: string | null;
};

export type ServerAction =
  | { type: "START" }
  | { type: "START_SUCCESS"; address: string | null; message: string }
  | { type: "START_FAILURE"; error: string }
  | { type: "STOP" }
  | { type: "STOP_SUCCESS" }
  | { type: "STOP_FAILURE"; error: string }
  | { type: "STATUS_UPDATE"; isRunning: boolean; address: string | null }
  | { type: "CLEAR_ERROR" };

export const initialServerState: ServerMachineState = {
  phase: "idle",
  address: null,
  message: null,
  error: null,
};

export function serverReducer(
  state: ServerMachineState,
  action: ServerAction,
): ServerMachineState {
  switch (action.type) {
    case "START":
      return {
        ...state,
        phase: "starting",
        message: "Starting server...",
        error: null,
      };

    case "START_SUCCESS":
      return {
        phase: "running",
        address: action.address,
        message: action.message,
        error: null,
      };

    case "START_FAILURE":
      return { ...state, phase: "error", message: null, error: action.error };

    case "STOP":
      return {
        ...state,
        phase: "stopping",
        message: "Stopping server...",
        error: null,
      };

    case "STOP_SUCCESS":
      return {
        phase: "idle",
        address: null,
        message: "Server stopped",
        error: null,
      };

    case "STOP_FAILURE":
      return {
        phase: "error",
        address: null,
        message: null,
        error: action.error,
      };

    case "STATUS_UPDATE":
      // Protect transitional states from poll interference
      if (state.phase === "starting" || state.phase === "stopping")
        return state;
      return {
        phase: action.isRunning ? "running" : "idle",
        address: action.address,
        message: state.message,
        error: state.error,
      };

    case "CLEAR_ERROR":
      return { ...state, error: null };
  }
}

/** Sync result summary formatting. */
export function formatSyncResult(result: {
  pulled_created: number;
  pulled_updated: number;
  pulled_deleted: number;
  pushed_created: number;
  pushed_updated: number;
  pushed_deleted: number;
}): string {
  const pulled =
    result.pulled_created + result.pulled_updated + result.pulled_deleted;
  const pushed =
    result.pushed_created + result.pushed_updated + result.pushed_deleted;
  return `Synced: ${pulled} pulled, ${pushed} pushed`;
}
