import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import Token from "@/models/token";
import { Option, Schema } from "effect";
import User from "@/models/user";
import UserClinicPermissions from "@/models/user-clinic-permissions";

/**
 * Get the current user's ID
 * @returns {Promise<string | null>} - The user's ID or null if not authenticated
 */
export const getCurrentUserId = createServerFn({ method: "GET" })
  .validator(() => ({}))
  .handler(async () => {
    const tokenCookie = getCookie("token");
    if (!tokenCookie) return null;

    const userOption = await Token.getUser(tokenCookie);
    return Option.match(userOption, {
      onNone: () => null,
      onSome: (user) => user.id,
    });
  });

/**
 * Get the current user all masked details
 * @returns {Promise<User.EncodedT | null>} - The user or null if not authenticated
 */
export const getCurrentUser = createServerFn({ method: "GET" })
  .validator(() => ({}))
  .handler(async () => {
    const tokenCookie = getCookie("token");
    if (!tokenCookie) return null;

    const userOption = await Token.getUser(tokenCookie);
    const user = Option.match(userOption, {
      onNone: () => null,
      onSome: (user) => {
        const encodedUser = Schema.encodeUnknownSync(User.UserSchema)({
          ...user,
          instance_url: Option.fromNullable(user.instance_url),
          clinic_id: Option.fromNullable(user.clinic_id),
          deleted_at: Option.fromNullable(user.deleted_at),
        });
        return encodedUser;
      },
    });

    return user;
  });

/**
 * Check if the current user has all specified permissions for a clinic
 * @param {string} clinicId - The clinic ID to check permissions for
 * @param {Array<keyof Pick<UserClinicPermissions.T, 'can_register_patients' | 'can_view_history' | 'can_edit_records' | 'can_delete_records' | 'is_clinic_admin'>>} permissions - Array of permissions to check
 * @returns {Promise<boolean>} - True if user has all specified permissions, false otherwise
 */
export const currentUserHasPermissions = createServerFn({ method: "GET" })
  .validator(
    (input: {
      clinicId: string;
      permissions: Array<
        keyof Pick<
          UserClinicPermissions.T,
          | "can_register_patients"
          | "can_view_history"
          | "can_edit_records"
          | "can_delete_records"
          | "is_clinic_admin"
        >
      >;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { clinicId, permissions } = data;

    // Get current user ID
    const tokenCookie = getCookie("token");
    if (!tokenCookie) return false;

    const userOption = await Token.getUser(tokenCookie);
    const userId = Option.match(userOption, {
      onNone: () => null,
      onSome: (user) => user.id,
    });

    if (!userId) return false;

    // Get user's permissions for the clinic
    const userPermissions = await UserClinicPermissions.API.getByUserAndClinic(
      userId,
      clinicId,
    );
    if (!userPermissions) return false;

    // Check if all requested permissions are true
    return permissions.every(
      (permission) => userPermissions[permission] === true,
    );
  });
