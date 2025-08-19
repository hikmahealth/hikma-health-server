import { createServerFn } from "@tanstack/react-start";
import User from "@/models/user";
import { permissionsMiddleware } from "@/middleware/auth";
import { getCurrentUser } from "@/lib/server-functions/auth";
import UserClinicPermissions from "@/models/user-clinic-permissions";
// import Patient from "@/models/patient";

export const getAllUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<User.EncodedT[]> => {
    return await User.API.getAll();
  },
);

export const getUserById = createServerFn({ method: "GET" })
  .validator((data: { id?: string | null } = {}) => data)
  .middleware([permissionsMiddleware])
  .handler(async ({ data, context }) => {
    if (context.role !== User.ROLES.SUPER_ADMIN) {
      return Promise.reject({
        message: "Unauthorized: Insufficient permissions",
      });
    }
    if (!data?.id) return null;
    const res = await User.API.getById(data.id);
    return res;
  });

export const currentUserHasRole = createServerFn({ method: "GET" })
  .validator((data: { role: User.RoleT }) => data)
  .handler(async ({ data }) => {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    return currentUser.role === data.role;
  });

export const getUserClinicPermissions = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    return await UserClinicPermissions.API.getByUser(data.userId);
  });
