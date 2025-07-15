import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/server-functions/auth";
import { getAllAppointmentsWithDetails } from "@/lib/server-functions/appointments";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import truncate from "lodash/truncate";
import { SelectInput } from "@/components/select-input";
import { toggleAppointmentStatus } from "@/lib/server-functions/appointments";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/app/appointments/")({
  component: RouteComponent,
  loader: async () => {
    const appointments = await getAllAppointmentsWithDetails();
    return {
      appointments,
      currentUser: await getCurrentUser(),
    };
  },
});

// TODO: Support pagination and search

function RouteComponent() {
  const { appointments, currentUser } = Route.useLoaderData();
  const router = useRouter();

  // Function to calculate age from date of birth
  const calculateAge = (dateOfBirth: Date | string | null | undefined) => {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };

  console.log({ appointments });

  // Function to handle status change
  const handleStatusChange = (appointmentId: string, newStatus: string) => {
    toggleAppointmentStatus({ data: { id: appointmentId, status: newStatus } })
      .then(() => {
        toast.success("Appointment status updated successfully");
        router.invalidate({ sync: true });
      })
      .catch((error) => {
        toast.error("Failed to update appointment status");
      });
  };

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Appointments</h1>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Given Name</TableHead>
                <TableHead>Last Name</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Duration (min)</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appt) => (
                <TableRow key={appt?.appointment?.id}>
                  <TableCell title={appt?.patient?.id}>
                    {truncate(appt?.patient?.id, { length: 12 })}
                  </TableCell>
                  <TableCell>{appt?.patient?.given_name}</TableCell>
                  <TableCell>{appt?.patient?.surname}</TableCell>
                  <TableCell>
                    {calculateAge(appt?.patient?.date_of_birth)}
                  </TableCell>
                  <TableCell>{appt?.clinic?.name}</TableCell>
                  <TableCell>{appt?.provider?.name}</TableCell>
                  <TableCell>{appt?.appointment?.duration}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {appt?.appointment?.notes}
                  </TableCell>
                  <TableCell>
                    <SelectInput
                      value={appt?.appointment?.status}
                      data={[
                        { label: "Pending", value: "pending" },
                        { label: "Confirmed", value: "confirmed" },
                        { label: "Cancelled", value: "cancelled" },
                        { label: "Completed", value: "completed" },
                        { label: "Checked In", value: "checked_in" },
                      ]}
                      onChange={(value) =>
                        handleStatusChange(
                          appt?.appointment?.id,
                          value as string
                        )
                      }
                    />
                    {/* <Select
                      defaultValue={appt?.appointment?.status}
                      onValueChange={(value) =>
                        handleStatusChange(appt?.appointment?.id, value)
                      }
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="checked_in">Checked In</SelectItem>
                      </SelectContent>
                    </Select> */}
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
