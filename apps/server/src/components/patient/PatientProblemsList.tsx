import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type PatientProblem from "@/models/patient-problem";
import type { Pagination } from "@/lib/server-functions/builders";
import { PaginationControls } from "./PaginationControls";

type Props = {
  problems: PatientProblem.EncodedT[];
  pagination: Pagination;
  onPageChange: (offset: number) => void;
  loading?: boolean;
};

const clinicalStatusVariant = (status: string) => {
  switch (status) {
    case "active":
      return "destructive" as const;
    case "remission":
      return "secondary" as const;
    case "resolved":
      return "default" as const;
    default:
      return "outline" as const;
  }
};

const verificationVariant = (status: string) => {
  switch (status) {
    case "confirmed":
      return "default" as const;
    case "provisional":
      return "secondary" as const;
    case "refuted":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return format(d, "MMM dd, yyyy");
  } catch {
    return "—";
  }
};

const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

function ProblemRow({ problem }: { problem: PatientProblem.EncodedT }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">{problem.problem_label}</p>
          <p className="text-xs text-muted-foreground">
            {problem.problem_code_system.toUpperCase()}: {problem.problem_code}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={clinicalStatusVariant(problem.clinical_status)}>
            {capitalize(problem.clinical_status)}
          </Badge>
          {problem.verification_status !== "confirmed" && (
            <Badge variant={verificationVariant(problem.verification_status)}>
              {capitalize(problem.verification_status)}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        {problem.onset_date && (
          <span>Onset: {formatDate(problem.onset_date)}</span>
        )}
        {problem.end_date && (
          <span>Resolved: {formatDate(problem.end_date)}</span>
        )}
        {problem.severity_score != null && (
          <span>Severity: {problem.severity_score}/10</span>
        )}
      </div>
    </div>
  );
}

export function PatientProblemsList({
  problems,
  pagination,
  onPageChange,
  loading,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Problems / Diagnoses</CardTitle>
        <CardDescription>
          Patient conditions and diagnoses, most recently updated first
        </CardDescription>
      </CardHeader>
      <CardContent>
        {problems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No problems or diagnoses recorded
          </div>
        ) : (
          <div className="space-y-3">
            {problems.map((problem) => (
              <ProblemRow key={problem.id} problem={problem} />
            ))}
            {pagination.total > 0 && (
              <PaginationControls
                pagination={pagination}
                onPageChange={onPageChange}
                loading={loading}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
