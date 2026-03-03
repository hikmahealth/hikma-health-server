import type { statCardConfig } from "@/lib/ai-service/report.gen";

type Props = {
  config: statCardConfig;
  rows: Record<string, unknown>[];
};

const formatValue = (value: unknown, format?: string): string => {
  const num = Number(value);
  if (isNaN(num)) return String(value ?? "—");

  switch (format) {
    case "Currency":
      return num.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
      });
    case "Percent":
      return `${(num * 100).toFixed(1)}%`;
    default:
      return num.toLocaleString();
  }
};

export const ReportStatCard = ({ config, rows }: Props) => {
  const row = rows[0];
  const value = row?.[config.valueField];

  return (
    <div className="flex flex-col justify-center h-full px-2">
      <p className="text-sm text-zinc-400 uppercase tracking-wide">
        {config.label}
      </p>
      <p className="text-3xl font-bold mt-1">
        {formatValue(value, config.format)}
      </p>
    </div>
  );
};
