import { useRef } from "react";
import { useEChart } from "./use-echart";
import type { lineChartConfig } from "@/lib/ai-service/report.gen";

type Props = {
  config: lineChartConfig;
  rows: Record<string, unknown>[];
};

export const ReportLineChart = ({ config, rows }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEChart(ref, {
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: rows.map((r) => String(r[config.xAxis] ?? "")),
    },
    yAxis: { type: "value" },
    series: [
      {
        type: "line",
        data: rows.map((r) => Number(r[config.yAxis])),
        smooth: true,
      },
    ],
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
  });

  return <div ref={ref} className="w-full h-full min-h-[200px]" />;
};
