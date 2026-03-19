import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type Prescription from "@/models/prescription";
import type { Pagination } from "@/lib/server-functions/builders";
import { PaginationControls } from "./PaginationControls";

type Props = {
  prescriptions: Prescription.EncodedT[];
  pagination: Pagination;
  onPageChange: (offset: number) => void;
  loading?: boolean;
};

const statusVariant = (status: string) => {
  switch (status) {
    case "picked-up":
      return "default" as const;
    case "pending":
    case "prepared":
      return "secondary" as const;
    case "cancelled":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

const priorityVariant = (priority: string | null) => {
  switch (priority) {
    case "emergency":
      return "destructive" as const;
    case "high":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

/** Format a prescription date for display. Returns "—" for null/missing/invalid. */
export const formatPrescriptionDate = (
  date: Date | string | null | undefined,
): string => {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return format(d, "MMM dd, yyyy");
  } catch {
    return "—";
  }
};

/** Derive a human-readable status label from a prescription status string. */
export const statusLabel = (status: string): string =>
  status
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Single prescription row. */
export function PrescriptionRow({
  prescription,
}: {
  prescription: Prescription.EncodedT;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            Prescribed: {formatPrescriptionDate(prescription.prescribed_at)}
          </p>
          {prescription.expiration_date && (
            <p className="text-xs text-muted-foreground">
              Expires: {formatPrescriptionDate(prescription.expiration_date)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant={statusVariant(prescription.status)}>
            {statusLabel(prescription.status)}
          </Badge>
          {prescription.priority && prescription.priority !== "normal" && (
            <Badge variant={priorityVariant(prescription.priority)}>
              {prescription.priority}
            </Badge>
          )}
        </div>
      </div>
      {prescription.notes && (
        <p className="text-sm text-muted-foreground mt-1">
          {prescription.notes}
        </p>
      )}
    </div>
  );
}

export function PrescriptionsList({
  prescriptions,
  pagination,
  onPageChange,
  loading,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prescriptions</CardTitle>
        <CardDescription>Active and past medications</CardDescription>
      </CardHeader>
      <CardContent>
        {prescriptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No prescriptions recorded
          </div>
        ) : (
          <div className="space-y-3">
            {prescriptions.map((rx) => (
              <PrescriptionRow key={rx.id} prescription={rx} />
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
