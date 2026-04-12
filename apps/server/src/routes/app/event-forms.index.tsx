import {
  createFileRoute,
  getRouteApi,
  useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import EventForm from "@/models/event-form";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { getEventForms } from "@/lib/server-functions/event-forms";
import { getAllClinics } from "@/lib/server-functions/clinics";
import { Result } from "@/lib/result";
import { Logger } from "@hh/js-utils";

const deleteForm = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    return EventForm.API.softDelete(data.id);
  });

const toggleFormDetail = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { id: string; field: "snapshot" | "editable"; value: boolean }) => d,
  )
  .handler(async ({ data }) => {
    switch (data.field) {
      case "snapshot":
        return await EventForm.API.toggleSnapshot({
          id: data.id,
          isSnapshot: data.value,
        });
      case "editable":
        return await EventForm.API.toggleEditable({
          id: data.id,
          isEditable: data.value,
        });
      default:
        throw Error("Unknown field");
    }
  });

export const Route = createFileRoute("/app/event-forms/")({
  component: RouteComponent,
  loader: async () => {
    const [forms, clinics] = await Promise.all([
      getEventForms({ data: { includeDeleted: false } }),
      getAllClinics().then((r) => Result.getOrElse(r, [])),
    ]);
    return { forms, clinics };
  },
});

function RouteComponent() {
  const { forms, clinics } = Route.useLoaderData();
  const route = useRouter();

  const clinicMap = new Map(clinics.map((c) => [c.id, c.name]));

  const handleSnapshotToggle = (id: string, isSnapshot: boolean) => {
    toggleFormDetail({ data: { id, field: "snapshot", value: isSnapshot } })
      .then(() => {
        toast.success("Form snapshot mode toggled successfully");
        route.invalidate({ sync: true });
      })
      .catch((error) => {
        toast.error("Failed to toggle form snapshot mode");
        Logger.error(error);
      });
  };

  const handleEditableToggle = (id: string, isEditable: boolean) => {
    toggleFormDetail({ data: { id, field: "editable", value: isEditable } })
      .then(() => {
        toast.success("Form editable mode toggled successfully");
        route.invalidate({ sync: true });
      })
      .catch((error) => {
        toast.error("Failed to toggle form editable mode");
        Logger.error(error);
      });
  };

  const handleDelete = (id: string) => {
    deleteForm({ data: { id } })
      .then(() => {
        toast.success("Form deleted successfully");
        route.invalidate({ sync: true });
      })
      .catch((error) => {
        toast.error("Failed to delete form");
        Logger.error(error);
      });
  };

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Event Forms</h1>
        <Link to="/app/event-forms/edit/$" params={{ _splat: "new" }}>
          <Button>Create New Form</Button>
        </Link>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableCaption>Event Forms</TableCaption>
            <TableHeader>
              <TableRow>
                {/*<TableHead>Snapshot</TableHead>*/}
                <TableHead>Editable</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Clinics</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No forms available
                  </TableCell>
                </TableRow>
              ) : (
                forms.map((form) => (
                  <TableRow key={form.id}>
                    {/*<TableCell>
                      <Checkbox
                        checked={form.is_snapshot_form}
                        onCheckedChange={() =>
                          handleSnapshotToggle(form.id, !form.is_snapshot_form)
                        }
                      />
                    </TableCell>*/}
                    <TableCell>
                      <Checkbox
                        checked={form.is_editable}
                        onCheckedChange={() =>
                          handleEditableToggle(form.id, !form.is_editable)
                        }
                      />
                    </TableCell>
                    <TableCell>{form.name || "—"}</TableCell>
                    <TableCell>{form.description || "—"}</TableCell>
                    <TableCell>
                      {!form.clinic_ids || form.clinic_ids.length === 0
                        ? "All"
                        : form.clinic_ids
                            .map((id) => clinicMap.get(id) ?? id)
                            .join(", ")}
                    </TableCell>
                    <TableCell>
                      {format(form.created_at, "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell>
                      {format(form.updated_at, "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Link
                        to="/app/event-forms/edit/$"
                        params={{ _splat: form.id }}
                      >
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(form.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
