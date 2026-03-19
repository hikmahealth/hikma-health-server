import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/server-functions/auth";
import { getAllAppointmentsWithDetails } from "@/lib/server-functions/appointments";
import ClinicDepartment from "@/models/clinic-department";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import truncate from "lodash/truncate";
import { SelectInput } from "@/components/select-input";
import { toggleAppointmentStatus } from "@/lib/server-functions/appointments";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/app/appointments/")({
  component: RouteComponent,
  loader: async () => {
    const appointments = await getAllAppointmentsWithDetails();

    // Get all unique department IDs from appointments
    const departmentIds = new Set<string>();
    appointments.forEach((appt) => {
      if (appt?.appointment?.departments) {
        appt.appointment.departments.forEach((dept: any) => {
          departmentIds.add(dept.id);
        });
      }
    });

    // Fetch department details
    const departmentMap = new Map<string, string>();
    for (const deptId of departmentIds) {
      try {
        const dept = await ClinicDepartment.API.getById(deptId);
        if (dept) {
          departmentMap.set(deptId, dept.name);
        }
      } catch {
        console.error(`Failed to fetch department ${deptId}`);
      }
    }

    return {
      appointments,
      currentUser: await getCurrentUser(),
      departmentNames: Object.fromEntries(departmentMap),
    };
  },
});

// TODO: Support pagination and search

function RouteComponent() {
  const { appointments, departmentNames } = Route.useLoaderData();
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
    <TooltipProvider>
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-6">Appointments</h1>

        <div className="rounded-md border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Appointment Time</TableHead>
                  <TableHead>Given Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Departments</TableHead>
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
                    <TableCell>
                      {appt?.appointment?.is_walk_in ? (
                        <Badge variant="secondary">Walk-in</Badge>
                      ) : (
                        <Badge variant="outline">Scheduled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {appt?.appointment?.timestamp ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            {new Date(
                              appt.appointment.timestamp,
                            ).toLocaleDateString()}
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(
                              appt.appointment.timestamp,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{appt?.patient?.given_name}</TableCell>
                    <TableCell>{appt?.patient?.surname}</TableCell>
                    <TableCell>
                      {calculateAge(appt?.patient?.date_of_birth)}
                    </TableCell>
                    <TableCell>{appt?.clinic?.name}</TableCell>
                    <TableCell>{appt?.provider?.name || ""}</TableCell>
                    <TableCell>
                      {appt?.appointment?.departments &&
                      appt?.appointment?.departments.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {appt.appointment.departments.map((dept: any) => {
                            const deptName = String(
                              departmentNames[dept.id] ||
                                `Dept ${dept.id.substring(0, 8)}`,
                            );
                            const statusIcon =
                              dept.status === "completed"
                                ? "✓"
                                : dept.status === "in_progress"
                                  ? "⏳"
                                  : "○";

                            return (
                              <Tooltip key={dept.id}>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant={
                                      dept.status === "completed"
                                        ? "default"
                                        : dept.status === "in_progress"
                                          ? "secondary"
                                          : "outline"
                                    }
                                    className="text-xs cursor-help"
                                  >
                                    {statusIcon} {deptName}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-1 text-xs">
                                    <p className="font-semibold">{deptName}</p>
                                    <p>
                                      Status:{" "}
                                      <span className="capitalize">
                                        {dept.status.replace("_", " ")}
                                      </span>
                                    </p>
                                    {dept.seen_at && (
                                      <p>
                                        Seen at:{" "}
                                        {new Date(
                                          dept.seen_at,
                                        ).toLocaleString()}
                                      </p>
                                    )}
                                    {dept.seen_by && (
                                      <p>Seen by: {String(dept.seen_by)}</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          No departments
                        </span>
                      )}
                    </TableCell>
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
                            value as string,
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
    </TooltipProvider>
  );
}
