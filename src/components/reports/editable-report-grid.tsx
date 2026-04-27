import { useCallback } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import type { ReportWithData } from "@/lib/ai-service/reports-editor";
import { editReportComponent } from "@/lib/ai-service/reports-editor";
import { ReportComponentCard } from "./report-component-card";
import { updateComponentSql } from "@/lib/server-functions/reports";
import type { reportComponent } from "@/lib/ai-service/report.gen";

type EditableReportGridProps = ReportWithData & {
  isSuperAdmin?: boolean;
  updateReport?: any;
  onDeleteComponent?: (componentId: string) => void;
  isEditable?: boolean;
};

/** Tunable grid configuration */
const GRID_CONFIG = {
  breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  cols: { lg: 12, md: 6, sm: 4, xs: 2, xxs: 1 },
  rowHeight: 120,
  margin: [16, 16] as [number, number],
  /** Resize handles shown on each component */
  resizeHandles: ["se", "sw", "ne", "nw"] as const,
  /** Vertical compaction keeps items packed upward */
  compactType: "vertical" as const,
} as const;

export const EditableReportGrid = ({
  report,
  data,
  isSuperAdmin = false,
  isEditable = false,
  updateReport,
  onDeleteComponent,
}: EditableReportGridProps) => {
  const { width, containerRef, mounted } = useContainerWidth();

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
      console.log({ updated });

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

  const layout: Layout = report.components.map((c) => ({
    i: c.id,
    x: c.position.x,
    y: c.position.y,
    w: c.position.w,
    h: c.position.h,
    minW: 1,
    minH: 1,
  }));

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      updateReport?.((prev: ReportWithData | null) => {
        if (!prev) return prev;
        const positionMap = new Map<
          string,
          { x: number; y: number; w: number; h: number }
        >();
        for (const item of newLayout) {
          positionMap.set(item.i, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          });
        }
        return {
          ...prev,
          report: {
            ...prev.report,
            components: prev.report.components.map((c) => {
              const pos = positionMap.get(c.id);
              if (!pos) return c;
              if (
                c.position.x === pos.x &&
                c.position.y === pos.y &&
                c.position.w === pos.w &&
                c.position.h === pos.h
              ) {
                return c;
              }
              return { ...c, position: pos };
            }),
          },
        };
      });
    },
    [updateReport],
  );

  return (
    <div ref={containerRef}>
      {mounted && (
        <ResponsiveGridLayout
          width={width}
          layouts={{ lg: layout }}
          breakpoints={GRID_CONFIG.breakpoints}
          cols={GRID_CONFIG.cols}
          rowHeight={GRID_CONFIG.rowHeight}
          margin={GRID_CONFIG.margin}
          dragConfig={{
            enabled: isEditable,
            handle: ".drag-handle",
            cancel: "textarea, input, button, pre, a, [contenteditable]",
          }}
          resizeConfig={{
            enabled: isEditable,
            handles: [...GRID_CONFIG.resizeHandles],
          }}
          onLayoutChange={handleLayoutChange}
          autoSize
        >
          {report.components.map((component) => {
            const componentData = data.find(
              (d) => d.componentId === component.id,
            );
            return (
              <div key={component.id}>
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
        </ResponsiveGridLayout>
      )}
    </div>
  );
};
