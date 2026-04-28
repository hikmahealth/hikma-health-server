import { useState } from "react";
import { uuidv7 } from "uuidv7";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { editReportComponent } from "@/lib/ai-service/reports-editor";
import type {
  reportComponent,
  componentDisplay,
  gridPosition,
} from "@/lib/ai-service/report.gen";

const DISPLAY_TYPES = [
  "Table",
  "BarChart",
  "LineChart",
  "PieChart",
  "StatCard",
] as const;

type DisplayTag = (typeof DISPLAY_TYPES)[number];

/** Sensible defaults for each display type — enough to render without error */
const defaultDisplayConfig = (tag: DisplayTag): componentDisplay => {
  switch (tag) {
    case "Table":
      return { TAG: "Table", _0: { columns: [] } };
    case "BarChart":
      return { TAG: "BarChart", _0: { xAxis: "x", yAxis: "y" } };
    case "LineChart":
      return { TAG: "LineChart", _0: { xAxis: "x", yAxis: "y" } };
    case "PieChart":
      return { TAG: "PieChart", _0: { labelField: "label", valueField: "value" } };
    case "StatCard":
      return { TAG: "StatCard", _0: { valueField: "value", label: "Total" } };
  }
};

/** Place new component below all existing ones by finding the grid bottom */
const nextGridPosition = (
  components: readonly reportComponent[] | undefined,
  columns: number,
): gridPosition => {
  let maxBottom = 0;
  for (const c of components ?? []) {
    const bottom = c.position.y + c.position.h;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return { x: 0, y: maxBottom, w: columns, h: 1 };
};

type Mode = "sql" | "ai";

type Props = {
  reportId: string;
  existingComponents: readonly reportComponent[];
  gridColumns: number;
  onAdd: (component: reportComponent) => void;
};

export const NewReportComponentDialog = ({
  reportId,
  existingComponents,
  gridColumns,
  onAdd,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("sql");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sql, setSql] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [displayType, setDisplayType] = useState<DisplayTag>("Table");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setSql("");
    setAiPrompt("");
    setDisplayType("Table");
    setMode("sql");
    setLoading(false);
    setError(null);
  };

  const canSubmitSql =
    title.trim() !== "" && description.trim() !== "" && sql.trim() !== "";

  const canSubmitAi =
    title.trim() !== "" && description.trim() !== "" && aiPrompt.trim() !== "";

  const canSubmit = mode === "sql" ? canSubmitSql : canSubmitAi;

  const handleSubmitSql = () => {
    if (!canSubmitSql) return;

    const component: reportComponent = {
      id: uuidv7(),
      reportId,
      title: title.trim(),
      description: description.trim(),
      prqlSource: sql.trim(),
      compiledSql: sql.trim(),
      compiledAt: new Date().toISOString(),
      compilerVersion: "manual",
      position: nextGridPosition(existingComponents, gridColumns),
      display: defaultDisplayConfig(displayType),
    };

    onAdd(component);
    reset();
    setOpen(false);
  };

  const handleSubmitAi = async () => {
    if (!canSubmitAi) return;

    setLoading(true);
    setError(null);

    const position = nextGridPosition(existingComponents, gridColumns);

    try {
      const result = await editReportComponent({
        data: {
          report_id: reportId,
          user_prompt: aiPrompt.trim(),
          component: {
            title: title.trim(),
            description: description.trim(),
            prql_source: "",
            display: defaultDisplayConfig("Table"),
            position,
          },
        },
      });

      // Preserve the position we calculated locally
      const component: reportComponent = { ...result, position };
      onAdd(component);
      reset();
      setOpen(false);
    } catch (err: any) {
      const message = err?.message ?? "Failed to generate component";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === "sql") {
      handleSubmitSql();
    } else {
      handleSubmitAi();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Component
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Report Component</DialogTitle>
          <DialogDescription>
            Add a component to this report using raw SQL or AI generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="comp-title">Title</Label>
            <Input
              id="comp-title"
              placeholder="e.g. Patient Count by Month"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comp-desc">Description</Label>
            <Input
              id="comp-desc"
              placeholder="Brief description of this component"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="w-full">
              <TabsTrigger value="sql" disabled={loading}>Raw SQL</TabsTrigger>
              <TabsTrigger value="ai" disabled={loading}>AI Generation</TabsTrigger>
            </TabsList>

            <TabsContent value="sql" className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="comp-display">Display Type</Label>
                <Select value={displayType} onValueChange={(v) => setDisplayType(v as DisplayTag)}>
                  <SelectTrigger id="comp-display">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comp-sql">SQL Query</Label>
                <Textarea
                  id="comp-sql"
                  placeholder="SELECT count(*) as value FROM patients"
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  className="min-h-[100px] font-mono text-sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="comp-ai-prompt">AI Prompt</Label>
                <Textarea
                  id="comp-ai-prompt"
                  placeholder="Describe what you want this component to show, e.g. 'Show a bar chart of patient registrations per month for the last 6 months'"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="min-h-[100px] text-sm"
                  disabled={loading}
                />
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {loading ? "Generating…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
