import type { ReportWithData } from "@/lib/ai-service/reports-editor";
import { ReportComponentCard } from "./report-component-card";

export const ReportGrid = ({ report, data }: ReportWithData) => (
  <div
    className="grid gap-4"
    style={{
      gridTemplateColumns: `repeat(${report.layout.columns}, 1fr)`,
    }}
  >
    {report.components.map((component) => {
      const componentData = data.find((d) => d.componentId === component.id);
      return (
        <div
          key={component.id}
          style={{
            gridColumn: `${component.position.x + 1} / span ${component.position.w}`,
            gridRow: `${component.position.y + 1} / span ${component.position.h}`,
          }}
        >
          <ReportComponentCard
            component={component}
            rows={componentData?.rows ?? []}
            error={componentData?.error ?? null}
          />
        </div>
      );
    })}
  </div>
);
