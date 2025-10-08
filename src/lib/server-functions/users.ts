import { createServerFn } from "@tanstack/react-start";
import User from "@/models/user";
import { permissionsMiddleware } from "@/middleware/auth";
import UserClinicPermissions from "@/models/user-clinic-permissions";
import { getCookie } from "@tanstack/react-start/server";
import Token from "@/models/token";
import { Option } from "effect";
// import Patient from "@/models/patient";

/**
 * Retrieves all users from the database
 * @returns Promise containing array of encoded user objects
 */
export const getAllUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<User.EncodedT[]> => {
    return await User.API.getAll();
  },
);

/**
 * Gets clinic IDs where a specific user has a given permission
 * @param data.userId - The ID of the user to check permissions for
 * @param data.permission - The specific permission type to check
 * @returns Array of clinic IDs where the user has the specified permission
 */
export const getClinicIdsWithUserPermission = createServerFn({ method: "GET" })
  .validator(
    (data: {
      userId: string;
      permission: UserClinicPermissions.UserPermissionsT;
    }) => data,
  )
  .middleware([permissionsMiddleware])
  .handler(async ({ data, context }) => {
    const user = await User.API.getById(data.userId);
    if (!user) return [];
    const permissions =
      await UserClinicPermissions.API.getClinicIdsWithPermission(
        user.id,
        data.permission,
      );
    return permissions;
  });

/**
 * Retrieves a user by their ID
 *
 * @param data.id - Optional user ID to retrieve
 * @returns User object if found and authorized, null if ID not provided
 * @throws {Object} Rejection object with message and source if user lacks SUPER_ADMIN role
 * @requires SUPER_ADMIN role for access
 * @param data.id - Optional user ID to retrieve
 * @returns User object if found and authorized, null if ID not provided, rejects if unauthorized
 */
export const getUserById = createServerFn({ method: "GET" })
  .validator((data: { id?: string | null } = {}) => data)
  .middleware([permissionsMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.userId) {
      return Promise.reject({
        message: "Unauthorized: Insufficient permissions",
        source: "getUserById",
      });
    }

    if (!data?.id) return null;

    const res = await User.API.getById(data.id);

    const clinicId = res?.clinic_id;
    if (!clinicId) return null;

    // check if the user is a super admin, is the owner of the user requested or is an admin of the clinic
    if (
      context.role === User.ROLES.SUPER_ADMIN ||
      context.permissions[clinicId]?.is_clinic_admin
    ) {
      return res;
    } else {
      return Promise.reject({
        message: "Unauthorized: Insufficient permissions",
        source: "getUserById",
      });
    }
  });

/**
 * Checks if the current user has a specific role
 * @param data.role - The role to check against the current user
 * @returns True if current user has the specified role, false otherwise
 */
export const currentUserHasRole = createServerFn({ method: "GET" })
  .validator((data: { role: User.RoleT }) => data)
  .handler(async ({ data }) => {
    const tokenCookie = getCookie("token");
    if (!tokenCookie) return false;

    const userOption = await Token.getUser(tokenCookie);
    const user = Option.match(userOption, {
      onNone: () => null,
      onSome: (user) => user,
    });

    if (!user) return false;
    return user.role === data.role;
  });

/**
 * Gets all clinic permissions for a specific user
 * @param data.userId - The ID of the user to get clinic permissions for
 * @returns User's clinic permissions
 */
export const getUserClinicPermissions = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    return await UserClinicPermissions.API.getByUser(data.userId);
  });
