import {
  createFileRoute,
  getRouteApi,
  useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import EventForm from "@/models/event-form";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

const getForms = createServerFn({
  method: "GET",
}).handler(async () => {
  const forms = await EventForm.API.getAll();
  return forms || [];
});

const deleteForm = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    return EventForm.API.softDelete(data.id);
  });

const toggleFormDetail = createServerFn({ method: "POST" })
  .validator(
    (d: { id: string; field: "snapshot" | "editable"; value: boolean }) => d
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
    return {
      forms: await getForms(),
    };
  },
});

function RouteComponent() {
  const { forms } = Route.useLoaderData();
  const route = useRouter();

  const handleSnapshotToggle = (id: string, isSnapshot: boolean) => {
    toggleFormDetail({ data: { id, field: "snapshot", value: isSnapshot } })
      .then(() => {
        toast.success("Form snapshot mode toggled successfully");
        route.invalidate({ sync: true });
      })
      .catch((error) => {
        toast.error("Failed to toggle form snapshot mode");
        console.error(error);
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
        console.error(error);
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
        console.error(error);
      });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Event Forms</h1>
        <Link to="/app/event-forms/edit">
          <Button>Create New Form</Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-3 border-b">Snapshot</th>
              <th className="p-3 border-b">Editable</th>
              <th className="p-3 border-b">Name</th>
              <th className="p-3 border-b">Description</th>
              <th className="p-3 border-b">Created</th>
              <th className="p-3 border-b">Updated</th>
              <th className="p-3 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {forms.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-3 text-center">
                  No forms available
                </td>
              </tr>
            ) : (
              forms.map((form) => (
                <tr key={form.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <Checkbox
                      checked={form.is_snapshot_form}
                      onCheckedChange={() =>
                        handleSnapshotToggle(form.id, !form.is_snapshot_form)
                      }
                    />
                  </td>
                  <td className="p-3">
                    <Checkbox
                      checked={form.is_editable}
                      onCheckedChange={() =>
                        handleEditableToggle(form.id, !form.is_editable)
                      }
                    />
                  </td>
                  <td className="p-3">{form.name || "—"}</td>
                  <td className="p-3">{form.description || "—"}</td>
                  <td className="p-3">
                    {format(form.created_at, "yyyy-MM-dd")}
                  </td>
                  <td className="p-3">
                    {format(form.updated_at, "yyyy-MM-dd")}
                  </td>
                  <td className="p-3 space-x-2">
                    <Link to={`/app/event-forms/edit/${form.id}`}>
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
