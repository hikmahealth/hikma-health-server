import type { ReportWithData } from "@/lib/ai-service/reports-editor";
import { editReportComponent } from "@/lib/ai-service/reports-editor";
import { ReportComponentCard } from "./report-component-card";
import { updateComponentSql } from "@/lib/server-functions/reports";
import { useCallback } from "react";
import type { reportComponent } from "@/lib/ai-service/report.gen";
import { Logger } from "@hh/js-utils";

type ReportGridProps = ReportWithData & {
  isSuperAdmin?: boolean;
  updateReport?: any;
  onDeleteComponent?: (componentId: string) => void;
  isEditable?: boolean;
};

export const ReportGrid = ({
  report,
  data,
  isSuperAdmin = false,
  isEditable = false,
  updateReport,
  onDeleteComponent,
}: ReportGridProps) => {
  const handleOnSqlEdit = useCallback(
    async (componentId: string, newSql: string) => {
      await updateComponentSql({
        data: { componentId, compiledSql: newSql },
      });

      updateReport?.((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          report: {
            ...prev.report,
            components: prev.report.components.map((c: any) =>
              c.id === componentId ? { ...c, compiledSql: newSql } : c,
            ),
          },
        };
      });
    },
    [],
  );

  const handleOnAIEdit = useCallback(
    async (componentId: string, prompt: string) => {
      const component = report.components.find((c) => c.id === componentId);
      if (!component) return;

      const updated = await editReportComponent({
        data: {
          report_id: report.id,
          user_prompt: prompt,
          component: {
            title: component.title,
            description: component.description ?? "",
            prql_source: component.prqlSource,
            display: component.display,
            position: component.position,
          },
        },
      });
      Logger.log({ updated });

      // Preserve the original id and reportId so the grid mapping stays consistent
      const merged: reportComponent = {
        ...updated,
        id: component.id,
        reportId: component.reportId,
      };

      updateReport?.((prev: ReportWithData | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          report: {
            ...prev.report,
            components: prev.report.components.map((c) =>
              c.id === componentId ? merged : c,
            ),
          },
        };
      });
    },
    [report.components, report.id, updateReport],
  );

  return (
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
              isSuperAdmin={isSuperAdmin}
              error={componentData?.error ?? null}
              onSqlEdit={handleOnSqlEdit}
              onAiEdit={handleOnAIEdit}
              onDelete={onDeleteComponent}
              isEditable={isEditable}
            />
          </div>
        );
      })}
    </div>
  );
};
