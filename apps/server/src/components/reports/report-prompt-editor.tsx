import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";
import type { prompt_refine_response_schema } from "@/lib/ai-service/reports-editor";

export type Suggestion = z.infer<
  typeof prompt_refine_response_schema
>["suggestions"][number];

// ── State & Actions ────────────────────────────────────────

export type TimeRangeMode = "fixed" | "rolling";

export type PromptEditorState = {
  prompt: string;
  name: string;
  timeRangeMode: TimeRangeMode;
  startAt: string;
  endAt: string;
  windowDays: number;
  suggestions: Suggestion[];
  hasRefined: boolean;
  status: "idle" | "refining" | "generating";
  error: string | null;
};

export type PromptEditorAction =
  | { type: "SET_PROMPT"; prompt: string }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_TIME_RANGE_MODE"; mode: TimeRangeMode }
  | { type: "SET_START_AT"; startAt: string }
  | { type: "SET_END_AT"; endAt: string }
  | { type: "SET_WINDOW_DAYS"; windowDays: number }
  | { type: "SELECT_SUGGESTION"; prompt: string }
  | { type: "REFINE_START" }
  | { type: "REFINE_SUCCESS"; suggestions: Suggestion[] }
  | { type: "REFINE_ERROR"; error: string }
  | { type: "GENERATE_START" }
  | { type: "GENERATE_SUCCESS" }
  | { type: "GENERATE_ERROR"; error: string };

export const promptEditorInitialState: PromptEditorState = {
  prompt: "",
  name: "",
  timeRangeMode: "rolling",
  startAt: "",
  endAt: "",
  windowDays: 30,
  suggestions: [],
  hasRefined: false,
  status: "idle",
  error: null,
};

export function promptEditorReducer(
  draft: PromptEditorState,
  action: PromptEditorAction,
) {
  switch (action.type) {
    case "SET_PROMPT":
      draft.prompt = action.prompt;
      break;
    case "SET_NAME":
      draft.name = action.name;
      break;
    case "SET_TIME_RANGE_MODE":
      draft.timeRangeMode = action.mode;
      break;
    case "SET_START_AT":
      draft.startAt = action.startAt;
      break;
    case "SET_END_AT":
      draft.endAt = action.endAt;
      break;
    case "SET_WINDOW_DAYS":
      draft.windowDays = action.windowDays;
      break;
    case "SELECT_SUGGESTION":
      draft.prompt = action.prompt;
      draft.suggestions = [];
      break;
    case "REFINE_START":
      draft.status = "refining";
      draft.error = null;
      break;
    case "REFINE_SUCCESS":
      draft.status = "idle";
      draft.suggestions = action.suggestions;
      draft.hasRefined = true;
      break;
    case "REFINE_ERROR":
      draft.status = "idle";
      draft.error = action.error;
      break;
    case "GENERATE_START":
      draft.status = "generating";
      draft.error = null;
      break;
    case "GENERATE_SUCCESS":
      draft.status = "idle";
      break;
    case "GENERATE_ERROR":
      draft.status = "idle";
      draft.error = action.error;
      break;
  }
}

// ── Component ──────────────────────────────────────────────

type ReportPromptEditorProps = {
  state: PromptEditorState;
  dispatch: React.Dispatch<PromptEditorAction>;
  onRefine: () => void;
  onGenerate: () => void;
};

const ROLLING_PRESETS = [7, 14, 30, 60, 90] as const;

export function ReportPromptEditor({
  state,
  dispatch,
  onRefine,
  onGenerate,
}: ReportPromptEditorProps) {
  const {
    prompt,
    name,
    timeRangeMode,
    startAt,
    endAt,
    windowDays,
    suggestions,
    hasRefined,
    status,
    error,
  } = state;
  const loading = status !== "idle";

  const hasValidTimeRange =
    timeRangeMode === "rolling"
      ? windowDays > 0
      : startAt !== "" && endAt !== "";

  const canSubmit = !loading && prompt.trim() && name.trim() && hasValidTimeRange;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-zinc-300">Name</label>
          <Input
            placeholder="e.g. Q1 Patient Summary"
            value={name}
            onChange={(e) =>
              dispatch({ type: "SET_NAME", name: e.target.value })
            }
            disabled={loading}
          />
        </div>
        {/* Time range mode toggle */}
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-zinc-300">
            Time Range
          </label>
          <div className="flex gap-2 mt-1">
            <Button
              type="button"
              variant={timeRangeMode === "rolling" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                dispatch({ type: "SET_TIME_RANGE_MODE", mode: "rolling" })
              }
              disabled={loading}
            >
              Rolling Window
            </Button>
            <Button
              type="button"
              variant={timeRangeMode === "fixed" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                dispatch({ type: "SET_TIME_RANGE_MODE", mode: "fixed" })
              }
              disabled={loading}
            >
              Fixed Dates
            </Button>
          </div>
        </div>

        {timeRangeMode === "rolling" ? (
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-300">
              Show last N days
            </label>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex gap-1.5">
                {ROLLING_PRESETS.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={windowDays === d ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      dispatch({ type: "SET_WINDOW_DAYS", windowDays: d })
                    }
                    disabled={loading}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={1}
                max={3650}
                value={windowDays}
                onChange={(e) =>
                  dispatch({
                    type: "SET_WINDOW_DAYS",
                    windowDays: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                className="w-24"
                disabled={loading}
              />
              <span className="text-sm text-zinc-400">days</span>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-zinc-300">
                Start date
              </label>
              <Input
                type="date"
                value={startAt}
                onChange={(e) =>
                  dispatch({ type: "SET_START_AT", startAt: e.target.value })
                }
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300">
                End date
              </label>
              <Input
                type="date"
                value={endAt}
                onChange={(e) =>
                  dispatch({ type: "SET_END_AT", endAt: e.target.value })
                }
                disabled={loading}
              />
            </div>
          </>
        )}
      </div>

      <Textarea
        placeholder="e.g. Show me patient registrations, visit trends, and a breakdown by sex over the last 3 months"
        value={prompt}
        onChange={(e) =>
          dispatch({ type: "SET_PROMPT", prompt: e.target.value })
        }
        className="min-h-[80px]"
        disabled={loading}
      />

      <div className="flex gap-2">
        <Button
          onClick={onRefine}
          disabled={!canSubmit}
          variant={hasRefined ? "outline" : "default"}
        >
          {status === "refining"
            ? "Refining..."
            : hasRefined
              ? "Refine Again"
              : "Continue"}
        </Button>
        {hasRefined && (
          <Button onClick={onGenerate} disabled={!canSubmit}>
            {status === "generating" ? "Generating..." : "Generate Report"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">
            Suggested improvements — click one to use it, or edit your prompt
            and refine again
          </h2>
          <div className="grid gap-3">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SELECT_SUGGESTION",
                    prompt: s.refined_prompt,
                  })
                }
                className="text-left rounded-lg border border-zinc-700 p-4 hover:border-zinc-500 hover:bg-zinc-900/50 transition-colors"
              >
                <p className="text-sm font-medium">{s.refined_prompt}</p>
                <p className="text-xs text-zinc-400 mt-2">{s.reasoning}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
