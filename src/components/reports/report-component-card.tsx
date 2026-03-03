import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { reportComponent } from "@/lib/ai-service/report.gen";
import { ReportStatCard } from "./displays/stat-card";
import { ReportLineChart } from "./displays/line-chart";
import { ReportPieChart } from "./displays/pie-chart";
import { ReportBarChart } from "./displays/bar-chart";
import { ReportDataTable } from "./displays/data-table";

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

type Props = {
  component: reportComponent;
  rows: Record<string, unknown>[];
  error: string | null;
};

export const ReportComponentCard = ({ component, rows, error }: Props) => (
  <Card className="h-full">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm">{component.title}</CardTitle>
      {component.description && (
        <CardDescription className="text-xs">
          {component.description}
        </CardDescription>
      )}
    </CardHeader>
    <CardContent className="flex-1">
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <DisplaySwitch display={component.display} rows={rows} />
      )}
    </CardContent>
  </Card>
);
