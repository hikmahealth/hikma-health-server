import { createFileRoute } from "@tanstack/react-router";
import { getAppointmentById } from "@/lib/server-functions/appointments";
import Appointment from "@/models/appointment";
import { useForm } from "react-hook-form";
import { createServerFn } from "@tanstack/react-start";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Schema } from "effect";
import { v1 as uuidV1 } from "uuid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, formatDate } from "date-fns";
import { cn } from "@/lib/utils";
import User from "@/models/user";
import Clinic from "@/models/clinic";
import { SelectInput } from "@/components/select-input";
import { getAllClinics } from "@/lib/server-functions/clinics";
import { getAllUsers } from "@/lib/server-functions/users";
import { getCurrentUser } from "@/lib/server-functions/auth";
import { PatientSearchSelect } from "@/components/patient-search-select";

const saveAppointment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      appointment: Appointment.EncodedT;
      id: string | null;
      currentUserName: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const { appointment, id, currentUserName } = data;
    return await Appointment.API.save(id, appointment, currentUserName);
  });

export const Route = createFileRoute("/app/appointments/edit/$")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const appointmentId = params["_splat"];
    const result: {
      appointment: Appointment.EncodedT | null;
      users: User.EncodedT[];
      clinics: Clinic.EncodedT[];
      currentUser: User.EncodedT | null;
    } = { appointment: null, users: [], clinics: [], currentUser: null };
    if (appointmentId) {
      result.appointment = (await getAppointmentById({
        data: { id: appointmentId },
      })) as Appointment.EncodedT | null;
    }
    result.users = (await getAllUsers()) as User.EncodedT[];
    result.clinics = (await getAllClinics()) as Clinic.EncodedT[];
    result.currentUser = (await getCurrentUser()) as User.EncodedT | null;
    return result;
  },
});

// Duration options
const durationOptions = [
  { label: "Unknown", value: 0 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 60 * 2 },
  { label: "3 hours", value: 60 * 3 },
  { label: "8 hours", value: 60 * 8 },
];

// Reason options
const reasonOptions = [
  { label: "Walk-in", value: "walk-in" },
  { label: "Doctor's Visit", value: "doctor-visit" },
  { label: "Screening", value: "screening" },
  { label: "Referral", value: "referral" },
  { label: "Checkup", value: "checkup" },
  { label: "Follow-up", value: "follow-up" },
  { label: "Counselling", value: "counselling" },
  { label: "Procedure", value: "procedure" },
  { label: "Investigation", value: "investigation" },
  { label: "Other", value: "other" },
];

// Status options
const statusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Completed", value: "completed" },
  { label: "Checked In", value: "checked_in" },
];

function RouteComponent() {
  const {
    appointment,
    users: providers,
    clinics,
    currentUser,
  } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const params = Route.useParams();
  const appointmentId = params._splat;
  const isEditing = !!appointmentId;

  console.log({ appointmentId, providers, clinics });

  const form = useForm<Appointment.EncodedT>({
    defaultValues: appointment
      ? Schema.encodeUnknownSync(Appointment.AppointmentSchema)(appointment)
      : {
          provider_id: null,
          clinic_id: "",
          patient_id: "",
          user_id: currentUser?.id || "",
          current_visit_id: "",
          fulfilled_visit_id: null,
          timestamp: new Date(),
          duration: 0,
          reason: "",
          notes: "",
          status: "pending",
          metadata: {},
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
          last_modified: new Date(),
          server_created_at: new Date(),
          deleted_at: null,
        },
  });

  // Handle form submission
  const onSubmit = async (values: Appointment.EncodedT) => {
    if (!currentUser) return;
    try {
      await saveAppointment({
        data: {
          appointment: {
            ...values,
            id: appointment?.id || uuidV1(),
            user_id: currentUser?.id || "",
          },
          id: isEditing ? appointment?.id || null : null,
          currentUserName: currentUser?.name || "",
        },
      });

      toast.success(
        isEditing
          ? "Appointment updated successfully"
          : "Appointment created successfully"
      );
      navigate({ to: "/app/appointments" });
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast.error("Failed to save appointment");
    }
  };

  // TODO: Default provider and clinic selection based on who is the current use

  return (
    <div className="">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-2">
            {isEditing ? "Edit Appointment" : "Create New Appointment"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {isEditing
              ? "Update the appointment information below"
              : "Enter the details for the new appointment"}
          </p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <PatientSearchSelect
                onChange={(patient) =>
                  form.setValue("patient_id", patient?.id || "")
                }
                label="Patient"
                clearable
                description="Select the patient for the appointment"
                withAsterisk
              />
              <FormField
                control={form.control}
                name="provider_id"
                render={({ field }) => (
                  <SelectInput
                    label="Provider"
                    data={providers.map((provider) => ({
                      label: provider.name,
                      value: provider.id,
                    }))}
                    value={field.value || ""}
                    onChange={field.onChange}
                    clearable
                    className="w-full"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="clinic_id"
                render={({ field }) => (
                  <SelectInput
                    label="Clinic"
                    data={clinics.map((clinic) => ({
                      label: clinic.name || "Unknown",
                      value: clinic.id,
                    }))}
                    value={field.value || ""}
                    onChange={field.onChange}
                    clearable
                    className="w-full"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="timestamp"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      Date and Time (current time is{" "}
                      {formatDate(new Date(), "PPP HH:mm")})
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(new Date(field.value), "PPP HH:mm")
                            ) : (
                              <span>Pick a date and time</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={new Date(field.value)}
                          onSelect={(date) => {
                            if (date) {
                              const currentDate = new Date(field.value);
                              date.setHours(currentDate.getHours());
                              date.setMinutes(currentDate.getMinutes());
                              field.onChange(date);
                            }
                          }}
                          initialFocus
                        />
                        <div className="p-3 border-t border-border">
                          <Input
                            type="time"
                            value={format(new Date(field.value), "HH:mm")}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value
                                .split(":")
                                .map(Number);
                              const date = new Date(field.value);
                              date.setHours(hours);
                              date.setMinutes(minutes);
                              field.onChange(date);
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <SelectInput
                    data={durationOptions.map((option) => ({
                      label: option.label,
                      value: option.value.toString(),
                    }))}
                    value={field.value.toString()}
                    onChange={(value) => field.onChange(Number(value))}
                    placeholder="Select duration"
                    className="w-full"
                    label="Duration"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <SelectInput
                    label="Reason"
                    data={reasonOptions.map((option) => ({
                      label: option.label,
                      value: option.value,
                    }))}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Select reason"
                    className="w-full"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <SelectInput
                    label="Status"
                    data={statusOptions.map((option) => ({
                      label: option.label,
                      value: option.value,
                    }))}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Select status"
                    className="w-full"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any additional notes here"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate({ to: "/app/appointments" })}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? "Update Appointment" : "Create Appointment"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
