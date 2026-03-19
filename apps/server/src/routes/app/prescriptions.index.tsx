import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/server-functions/auth";
import {
  getAllPrescriptions,
  togglePrescriptionStatus,
} from "@/lib/server-functions/prescriptions";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { SelectInput } from "@/components/select-input";
import Prescription from "@/models/prescription";
import upperFirst from "lodash/upperFirst";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/prescriptions/")({
  component: RouteComponent,
  loader: async () => {
    return {
      prescriptions: await getAllPrescriptions(),
      currentUser: await getCurrentUser(),
    };
  },
});

function RouteComponent() {
  const router = useRouter();
  const { prescriptions, currentUser } = Route.useLoaderData();

  const handleStatusChange = async (id: string, status: string) => {
    togglePrescriptionStatus({ data: { id, status } })
      .then((res) => {
        toast.success("Status updated successfully");
        router.invalidate({ sync: true });
      })
      .catch((err) => {
        toast.error("Failed to update status");
      });
  };

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        <Button asChild>
          <Link to="/app/prescriptions/edit/$" params={{ _splat: "new" }}>
            Add New Prescription
          </Link>
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Provider ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prescribed At</TableHead>
                <TableHead>Expiration Date</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescriptions.map((prescription) => (
                <TableRow key={prescription.id}>
                  <TableCell>{prescription.patient_id}</TableCell>
                  <TableCell>{prescription.provider_id}</TableCell>
                  <TableCell>
                    <SelectInput
                      data={Prescription.statusValues.map((status) => ({
                        value: status,
                        label: upperFirst(status),
                      }))}
                      value={prescription.status}
                      onChange={(value) =>
                        handleStatusChange(prescription.id, value || "")
                      }
                      size="sm"
                      clearable={false}
                    />
                  </TableCell>
                  <TableCell>
                    {prescription.prescribed_at
                      ? format(new Date(prescription.prescribed_at), "PPP")
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    {prescription.expiration_date
                      ? format(new Date(prescription.expiration_date), "PPP")
                      : "N/A"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {prescription.notes}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
