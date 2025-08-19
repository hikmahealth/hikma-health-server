import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createServerFn } from "@tanstack/react-start";
import {
  Table,
  TableBody,
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
import { getCurrentUserId } from "@/lib/server-functions/auth";
import { getAllClinics } from "@/lib/server-functions/clinics";
import {
  currentUserHasRole,
  getUserById,
  getUserClinicPermissions,
} from "@/lib/server-functions/users";
import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import UserClinicPermissions from "@/models/user-clinic-permissions";
import { toast } from "sonner";
import { permissionsMiddleware } from "@/middleware/auth";
import User from "@/models/user";

const addClinicPermissions = createServerFn({ method: "POST" })
  .validator(
    (data: { userId: string; clinicId: string; currentUserId: string }) => data,
  )
  .middleware([permissionsMiddleware])
  .handler(async ({ data, context }) => {
    const { userId, clinicId, currentUserId } = data;
    if (context.role !== User.ROLES.SUPER_ADMIN) {
      throw new Error("Unauthorized");
    }
    const newPermission = {
      user_id: userId,
      clinic_id: clinicId,
      can_register_patients: false,
      can_view_history: false,
      can_edit_records: false,
      can_delete_records: false,
      is_clinic_admin: false,
    };

    return await UserClinicPermissions.API.upsert(newPermission, currentUserId);
  });

const togglePermission = createServerFn({ method: "POST" })
  .validator(
    (data: {
      userId: string;
      clinicId: string;
      permission: keyof Pick<
        UserClinicPermissions.T,
        | "can_register_patients"
        | "can_view_history"
        | "can_edit_records"
        | "can_delete_records"
        | "is_clinic_admin"
      >;
      value: boolean;
      currentUserId: string;
    }) => data,
  )
  .middleware([permissionsMiddleware])
  .handler(async ({ data, context }) => {
    const { userId, clinicId, permission, value, currentUserId } = data;

    if (context.role !== User.ROLES.SUPER_ADMIN) {
      throw new Error("Unauthorized");
    }

    // Get existing permissions
    const existingPermissions =
      await UserClinicPermissions.API.getByUserAndClinic(userId, clinicId);
    if (!existingPermissions) {
      throw new Error("User permissions not found for this clinic");
    }

    const updatedPermission = {
      ...existingPermissions,
      [permission]: value,
    };

    return await UserClinicPermissions.API.upsert(
      updatedPermission,
      currentUserId,
    );
  });

export const Route = createFileRoute("/app/users/manage-permissions/$")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const isSuperAdmin = await currentUserHasRole({
      data: { role: "super_admin" },
    });

    if (!isSuperAdmin) {
      throw redirect({
        to: "/app",
        from: "/app/users/manage-permissions/$",
        state: {},
        replace: true,
      });
    }

    const userId = params._splat;
    if (!userId) {
      throw redirect({
        to: "/app/users",
        from: "/app/users/manage-permissions/$",
        state: {},
        replace: true,
      });
    }

    const user = await getUserById({ data: { id: userId } });
    if (!user) {
      throw redirect({
        to: "/app/users",
        from: "/app/users/manage-permissions/$",
        state: {},
        replace: true,
      });
    }

    const userClinicPermissions = await getUserClinicPermissions({
      data: { userId },
    });

    return {
      user,
      userClinicPermissions,
      clinics: await getAllClinics(),
      currentUserId: await getCurrentUserId(),
      isSuperAdmin,
    };
  },
});

function RouteComponent() {
  const router = useRouter();
  const { user, userClinicPermissions, clinics, currentUserId } =
    Route.useLoaderData();
  const [permissions, setPermissions] = useState<
    UserClinicPermissions.EncodedT[]
  >(userClinicPermissions || []);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [isAddingClinic, setIsAddingClinic] = useState(false);
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(
    null,
  );

  const handlePermissionChange = async (
    clinicId: string,
    permission: keyof Pick<
      UserClinicPermissions.T,
      | "can_register_patients"
      | "can_view_history"
      | "can_edit_records"
      | "can_delete_records"
      | "is_clinic_admin"
    >,
    checked: boolean,
  ) => {
    const permissionKey = `${clinicId}-${permission}`;
    setUpdatingPermission(permissionKey);

    try {
      await togglePermission({
        data: {
          userId: user.id,
          clinicId,
          permission,
          value: checked,
          currentUserId: currentUserId || "",
        },
      });

      setPermissions((prev) =>
        prev.map((perm) =>
          perm.clinic_id === clinicId
            ? { ...perm, [permission]: checked }
            : perm,
        ),
      );

      toast.success("Permission updated successfully");
      router.invalidate({ sync: true });
    } catch (error) {
      console.error("Failed to update permission:", error);
      toast.error("Failed to update permission");
    } finally {
      setUpdatingPermission(null);
    }
  };

  const handleAddClinic = async () => {
    if (!selectedClinicId) return;

    // Check if clinic already has permissions
    const existingPermission = permissions.find(
      (p) => p.clinic_id === selectedClinicId,
    );
    if (existingPermission) return;

    setIsAddingClinic(true);

    try {
      await addClinicPermissions({
        data: {
          userId: user.id,
          clinicId: selectedClinicId,
          currentUserId: currentUserId || "",
        },
      });

      const newPermission: UserClinicPermissions.EncodedT = {
        user_id: user.id,
        clinic_id: selectedClinicId,
        can_register_patients: false,
        can_view_history: false,
        can_edit_records: false,
        can_delete_records: false,
        is_clinic_admin: false,
        created_by: currentUserId,
        last_modified_by: currentUserId,
        created_at: new Date(),
        updated_at: new Date(),
      };

      setPermissions((prev) => [...prev, newPermission]);
      setSelectedClinicId("");
      toast.success("Clinic permissions added successfully");
    } catch (error) {
      console.error("Failed to add clinic permissions:", error);
      toast.error("Failed to add clinic permissions");
    } finally {
      setIsAddingClinic(false);
    }
  };

  const availableClinics = clinics.filter(
    (clinic) => !permissions.some((p) => p.clinic_id === clinic.id),
  );

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Permissions</h1>
          <p className="text-muted-foreground">
            Managing permissions for {user.name}
          </p>
        </div>
        <Link to="/app/users">
          <Button variant="outline">Back to Users</Button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* Add New Clinic Section */}
        <div className="flex items-center gap-4 p-4 border rounded-lg">
          <span className="font-medium">Add clinic permissions:</span>
          <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a clinic" />
            </SelectTrigger>
            <SelectContent>
              {availableClinics.map((clinic) => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAddClinic}
            disabled={!selectedClinicId || isAddingClinic}
          >
            {isAddingClinic ? "Adding..." : "Add Clinic"}
          </Button>
        </div>

        {/* Permissions Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic Name</TableHead>
                <TableHead className="text-center">Register Patients</TableHead>
                <TableHead className="text-center">View History</TableHead>
                <TableHead className="text-center">Edit Records</TableHead>
                <TableHead className="text-center">Delete Records</TableHead>
                <TableHead className="text-center">Clinic Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No clinic permissions assigned
                  </TableCell>
                </TableRow>
              ) : (
                permissions.map((permission) => {
                  const clinic = clinics.find(
                    (c) => c.id === permission.clinic_id,
                  );

                  return (
                    <TableRow key={permission.clinic_id}>
                      <TableCell className="font-medium">
                        {clinic?.name || "Unknown Clinic"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permission.can_register_patients}
                          disabled={
                            updatingPermission ===
                            `${permission.clinic_id}-can_register_patients`
                          }
                          onCheckedChange={(checked) =>
                            handlePermissionChange(
                              permission.clinic_id,
                              "can_register_patients",
                              !!checked,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permission.can_view_history}
                          disabled={
                            updatingPermission ===
                            `${permission.clinic_id}-can_view_history`
                          }
                          onCheckedChange={(checked) =>
                            handlePermissionChange(
                              permission.clinic_id,
                              "can_view_history",
                              !!checked,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permission.can_edit_records}
                          disabled={
                            updatingPermission ===
                            `${permission.clinic_id}-can_edit_records`
                          }
                          onCheckedChange={(checked) =>
                            handlePermissionChange(
                              permission.clinic_id,
                              "can_edit_records",
                              !!checked,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permission.can_delete_records}
                          disabled={
                            updatingPermission ===
                            `${permission.clinic_id}-can_delete_records`
                          }
                          onCheckedChange={(checked) =>
                            handlePermissionChange(
                              permission.clinic_id,
                              "can_delete_records",
                              !!checked,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permission.is_clinic_admin}
                          disabled={
                            updatingPermission ===
                            `${permission.clinic_id}-is_clinic_admin`
                          }
                          onCheckedChange={(checked) =>
                            handlePermissionChange(
                              permission.clinic_id,
                              "is_clinic_admin",
                              !!checked,
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
