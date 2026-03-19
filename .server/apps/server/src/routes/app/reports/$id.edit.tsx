import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportGrid } from "@/components/reports/report-grid";
import {
  editReport,
  type ReportWithData,
} from "@/lib/ai-service/reports-editor";

export const Route = createFileRoute("/app/reports/$id/edit")({
  component: RouteComponent,
});

function RouteComponent() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ReportWithData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await editReport({
        data: { user_description: prompt },
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Create Report</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Describe the report you want to generate
        </p>
      </div>

      <div className="items-end">
        <Textarea
          placeholder="e.g. Show me patient registrations, visit trends, and a breakdown by sex over the last 3 months"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[80px] flex-1"
          disabled={loading}
        />
        <Button onClick={handleSubmit} disabled={loading || !prompt.trim()}>
          {loading ? "Generating..." : "Generate"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && <ReportGrid report={result.report} data={result.data} />}
    </div>
  );
}
