import { useRef } from "react";
import { useEChart } from "./use-echart";
import type { barChartConfig } from "@/lib/ai-service/report.gen";

type Props = {
  config: barChartConfig;
  rows: Record<string, unknown>[];
};

export const ReportBarChart = ({ config, rows }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const horizontal = config.orientation === "Horizontal";

  useEChart(ref, {
    tooltip: { trigger: "axis" },
    [horizontal ? "yAxis" : "xAxis"]: {
      type: "category",
      data: rows.map((r) => String(r[config.xAxis] ?? "")),
    },
    [horizontal ? "xAxis" : "yAxis"]: { type: "value" },
    series: [
      {
        type: "bar",
        data: rows.map((r) => Number(r[config.yAxis])),
        ...(config.stacked && { stack: "total" }),
      },
    ],
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
  });

  return <div ref={ref} className="w-full h-full min-h-[200px]" />;
};
