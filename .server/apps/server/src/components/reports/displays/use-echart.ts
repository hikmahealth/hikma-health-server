import { useEffect, useRef, type RefObject } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

export const useEChart = (
  containerRef: RefObject<HTMLDivElement | null>,
  option: EChartsOption,
) => {
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    chartRef.current = echarts.init(el);
    chartRef.current.setOption(option);

    const observer = new ResizeObserver(() => chartRef.current?.resize());
    observer.observe(el);

    return () => {
      observer.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [containerRef, option]);
};
