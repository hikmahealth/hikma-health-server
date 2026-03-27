import { useState } from "react";
import { uuidv7 } from "uuidv7";
import { Plus } from "lucide-react";
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
  components: readonly reportComponent[],
  columns: number,
): gridPosition => {
  let maxBottom = 0;
  for (const c of components) {
    const bottom = c.position.y + c.position.h;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return { x: 0, y: maxBottom, w: columns, h: 1 };
};

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sql, setSql] = useState("");
  const [displayType, setDisplayType] = useState<DisplayTag>("Table");

  const reset = () => {
    setTitle("");
    setDescription("");
    setSql("");
    setDisplayType("Table");
  };

  const canSubmit = title.trim() !== "" && sql.trim() !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;

    const component: reportComponent = {
      id: uuidv7(),
      reportId,
      title: title.trim(),
      ...(description.trim() && { description: description.trim() }),
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
            Add a SQL-powered component to this report.
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
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comp-desc">Description (optional)</Label>
            <Input
              id="comp-desc"
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
