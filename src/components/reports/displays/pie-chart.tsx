import { useRef } from "react";
import { useEChart } from "./use-echart";
import type { pieChartConfig } from "@/lib/ai-service/report.gen";

type Props = {
  config: pieChartConfig;
  rows: Record<string, unknown>[];
};

export const ReportPieChart = ({ config, rows }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEChart(ref, {
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["35%", "65%"],
        data: rows.map((r) => ({
          name: String(r[config.labelField] ?? ""),
          value: Number(r[config.valueField]),
        })),
      },
    ],
  });

  return <div ref={ref} className="w-full h-full min-h-[200px]" />;
};
