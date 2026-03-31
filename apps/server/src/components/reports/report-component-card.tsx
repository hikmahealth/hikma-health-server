import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { reportComponent } from "@/lib/ai-service/report.gen";
import { Code, Sparkles, Pencil, Trash2 } from "lucide-react";
import { ReportStatCard } from "./displays/stat-card";
import { ReportLineChart } from "./displays/line-chart";
import { ReportPieChart } from "./displays/pie-chart";
import { ReportBarChart } from "./displays/bar-chart";
import { ReportDataTable } from "./displays/data-table";
import { countLines } from "@/lib/utils";
import { once } from "es-toolkit/compat";
import { toast } from "sonner";

const DisplaySwitch = ({
  display,
  rows,
}: {
  display: reportComponent["display"];
  rows: Record<string, unknown>[];
}) => {
  switch (display.TAG) {
    case "StatCard":
      return <ReportStatCard config={display._0} rows={rows} />;
    case "LineChart":
      return <ReportLineChart config={display._0} rows={rows} />;
    case "PieChart":
      return <ReportPieChart config={display._0} rows={rows} />;
    case "BarChart":
      return <ReportBarChart config={display._0} rows={rows} />;
    case "Table":
      return <ReportDataTable config={display._0} rows={rows} />;
  }
};

type ActivePanel = "display" | "code" | "ai-edit" | "sql-edit";

type Props = {
  component: reportComponent;
  rows: Record<string, unknown>[];
  error: string | null;
  isSuperAdmin?: boolean;
  onAiEdit?: (componentId: string, prompt: string) => void | Promise<void>;
  onSqlEdit?: (componentId: string, sql: string) => void | Promise<void>;
  onDelete?: (componentId: string) => void | Promise<void>;
};

export const ReportComponentCard = ({
  component,
  rows,
  error,
  isSuperAdmin = false,
  onAiEdit,
  onSqlEdit,
  onDelete,
}: Props) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>("display");
  const [aiPrompt, setAiPrompt] = useState("");
  const [editedSql, setEditedSql] = useState(component.compiledSql);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Keep editedSql in sync when the component's SQL changes (e.g. after save)
  useEffect(() => {
    setEditedSql(component.compiledSql);
  }, [component.compiledSql]);

  const toggle = (panel: ActivePanel) =>
    setActivePanel((prev) => (prev === panel ? "display" : panel));

  const countLinesOnce = once(countLines);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm">{component.title}</CardTitle>
            {component.description && (
              <CardDescription className="text-xs">
                {component.description}
              </CardDescription>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant={activePanel === "code" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => toggle("code")}
              title="View SQL"
            >
              <Code className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={activePanel === "ai-edit" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => toggle("ai-edit")}
              title="AI edit"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={activePanel === "sql-edit" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => toggle("sql-edit")}
              title="Edit SQL"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => onDelete(component.id)}
                title="Delete component"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {activePanel === "display" && (
          <>
            {dirty ? (
              <p className="text-sm text-amber-600 py-4 text-center">
                Please save the report to see the changes.
              </p>
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : (
              <DisplaySwitch display={component.display} rows={rows} />
            )}
          </>
        )}

        {activePanel === "code" && (
          <div className="space-y-2">
            <pre className="text-xs bg-zinc-900 text-white rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap">
              <code>{component.compiledSql}</code>
            </pre>
          </div>
        )}

        {activePanel === "ai-edit" && (
          <div className="space-y-2">
            <Textarea
              placeholder="Describe how to change this component..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <Button
              size="sm"
              disabled={!aiPrompt.trim() || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onAiEdit?.(component.id, aiPrompt);
                  toast.success("AI edit applied");
                  setAiPrompt("");
                  setDirty(true);
                  setActivePanel("display");
                } catch (err: any) {
                  toast.error(err?.message ?? "Failed to apply AI edit");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Applying..." : "Apply"}
            </Button>
          </div>
        )}

        {activePanel === "sql-edit" && (
          <div className="space-y-2">
            <Textarea
              value={editedSql}
              onChange={(e) => setEditedSql(e.target.value)}
              className="min-h-[80px] text-sm font-mono"
              rows={countLinesOnce(editedSql)}
            />
            <Button
              size="sm"
              disabled={editedSql === component.compiledSql || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSqlEdit?.(component.id, editedSql);
                  toast.success("SQL updated");
                  setDirty(true);
                  setActivePanel("display");
                } catch (err: any) {
                  toast.error(err?.message ?? "Failed to save SQL");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving..." : "Apply"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
