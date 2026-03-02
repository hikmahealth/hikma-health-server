import type { tableConfig } from "@/lib/ai-service/report.gen";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type Props = {
  config: tableConfig;
  rows: Record<string, unknown>[];
};

const formatCell = (value: unknown, format?: string): string => {
  if (value == null) return "—";

  switch (format) {
    case "Date":
      return new Date(String(value)).toLocaleDateString();
    case "Number":
      return Number(value).toLocaleString();
    case "Currency":
      return Number(value).toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
      });
    case "Percent":
      return `${(Number(value) * 100).toFixed(1)}%`;
    default:
      return String(value);
  }
};

export const ReportDataTable = ({ config, rows }: Props) => (
  <div className="overflow-auto max-h-[400px]">
    <Table>
      <TableHeader>
        <TableRow>
          {config.columns.map((col) => (
            <TableHead key={col.key}>{col.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {config.columns.map((col) => (
              <TableCell key={col.key}>
                {formatCell(row[col.key], col.format)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
