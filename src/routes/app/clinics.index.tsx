import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import Clinic from "@/models/clinic";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LucideEdit, LucideTrash } from "lucide-react";
import { toast } from "sonner";
import { getAllClinics } from "@/lib/server-functions/clinics";

const deleteClinic = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return Clinic.softDelete(data.id);
  });

export const Route = createFileRoute("/app/clinics/")({
  component: RouteComponent,
  loader: async () => {
    const clinics = await getAllClinics();
    return { clinics };
  },
});

function RouteComponent() {
  const { clinics } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();

  const handleEdit = (id: string) => {
    navigate({ to: `/app/clinics/edit/${id}` });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this clinic?")) {
      return;
    }

    deleteClinic({ data: { id } })
      .catch((error) => {
        console.error(error);
        toast.error(error.message);
      })
      .then(() => {
        toast.success("Clinic deleted successfully");
        router.invalidate({ sync: true });
      });
  };

  return (
    <div>
      <Table>
        <TableCaption>A list of clinics.</TableCaption>
        <TableHeader>
          <TableRow>
            {/* <TableHead className="w-[100px]">ID</TableHead> */}
            <TableHead>Name</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clinics?.map((clinic) => (
            <TableRow key={clinic.id} className="py-2">
              {/* <TableCell className="font-medium">{clinic.id}</TableCell> */}
              <TableCell>{clinic.name}</TableCell>
              <TableCell className="flex gap-4">
                <Button variant="outline" onClick={() => handleEdit(clinic.id)}>
                  <LucideEdit className="mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="text-red-500"
                  onClick={() => handleDelete(clinic.id)}
                >
                  <LucideTrash className="mr-2" />
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
