import { Either, Schema } from "effect";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  sql,
} from "kysely";
import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
import User from "./user";
import Clinic from "./clinic";
import { Option } from "effect";
import Token from "./token";
import { getCookie } from "@tanstack/react-start/server";

namespace UserClinicPermissions {
  export const UserClinicPermissionsSchema = Schema.Struct({
    user_id: Schema.String,
    clinic_id: Schema.String,
    can_register_patients: Schema.Boolean,
    can_view_history: Schema.Boolean,
    can_edit_records: Schema.Boolean,
    can_delete_records: Schema.Boolean,
    is_clinic_admin: Schema.Boolean,
    created_by: Schema.NullOr(Schema.String),
    last_modified_by: Schema.NullOr(Schema.String),
    created_at: Schema.DateFromSelf,
    updated_at: Schema.DateFromSelf,
  });

  // User Attribute permissions
  export const UserPermissions = Schema.Struct({
    CAN_REGISTER_PATIENTS: Schema.Literal("can_register_patients"),
    CAN_VIEW_HISTORY: Schema.Literal("can_view_history"),
    CAN_EDIT_RECORDS: Schema.Literal("can_edit_records"),
    CAN_DELETE_RECORDS: Schema.Literal("can_delete_records"),
    IS_CLINIC_ADMIN: Schema.Literal("is_clinic_admin"),
  });

  export const userPermissions = {
    CAN_REGISTER_PATIENTS: "can_register_patients" as const,
    CAN_VIEW_HISTORY: "can_view_history" as const,
    CAN_EDIT_RECORDS: "can_edit_records" as const,
    CAN_DELETE_RECORDS: "can_delete_records" as const,
    IS_CLINIC_ADMIN: "is_clinic_admin" as const,
  } satisfies Record<
    string,
    Schema.Schema.Type<typeof UserPermissions>[keyof Schema.Schema.Type<
      typeof UserPermissions
    >]
  >;

  // Role permissions
  export const rolePermissions: Record<
    User.RoleT,
    Record<UserPermissionsT, boolean>
  > = {
    super_admin: {
      [userPermissions.CAN_REGISTER_PATIENTS]: true,
      [userPermissions.CAN_VIEW_HISTORY]: true,
      [userPermissions.CAN_EDIT_RECORDS]: true,
      [userPermissions.CAN_DELETE_RECORDS]: true,
      [userPermissions.IS_CLINIC_ADMIN]: true,
    },
    admin: {
      [userPermissions.CAN_REGISTER_PATIENTS]: true,
      [userPermissions.CAN_VIEW_HISTORY]: true,
      [userPermissions.CAN_EDIT_RECORDS]: true,
      [userPermissions.CAN_DELETE_RECORDS]: true,
      [userPermissions.IS_CLINIC_ADMIN]: true,
    },
    provider: {
      [userPermissions.CAN_REGISTER_PATIENTS]: true,
      [userPermissions.CAN_VIEW_HISTORY]: true,
      [userPermissions.CAN_EDIT_RECORDS]: true,
      [userPermissions.CAN_DELETE_RECORDS]: false,
      [userPermissions.IS_CLINIC_ADMIN]: false,
    },
    registrar: {
      [userPermissions.CAN_REGISTER_PATIENTS]: true,
      [userPermissions.CAN_VIEW_HISTORY]: false,
      [userPermissions.CAN_EDIT_RECORDS]: false,
      [userPermissions.CAN_DELETE_RECORDS]: false,
      [userPermissions.IS_CLINIC_ADMIN]: false,
    },
  };

  export type T = typeof UserClinicPermissionsSchema.Type;
  export type EncodedT = typeof UserClinicPermissionsSchema.Encoded;
  export type RolePermissions = typeof rolePermissions;

  /**
   * Union type representing the available permission fields that can be checked for a user
   * within a specific clinic context. These permissions control various aspects of
   * patient data management and clinic administration.
   */
  export type UserPermissionsT = keyof Pick<
    T,
    | "can_register_patients"
    | "can_view_history"
    | "can_edit_records"
    | "can_delete_records"
    | "is_clinic_admin"
  >;

  export const fromDbEntry = (
    entry: UserClinicPermissions.Table.UserClinicPermissions,
  ): Either.Either<UserClinicPermissions.T, Error> => {
    return Schema.decodeUnknownEither(UserClinicPermissionsSchema)(entry);
  };

  /**
   * Given a role, returns the permissions for that role.
   * @param role
   */
  export const getRolePermissions = (
    role: User.RoleT,
  ): Record<UserPermissionsT, boolean> => {
    return rolePermissions[role];
  };

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = true;
    export const name = "user_clinic_permissions";
    /** The name of the table in the mobile database */
    export const mobileName = "user_clinic_permissions";

    export const columns = {
      user_id: "user_id",
      clinic_id: "clinic_id",
      can_register_patients: "can_register_patients",
      can_view_history: "can_view_history",
      can_edit_records: "can_edit_records",
      can_delete_records: "can_delete_records",
      is_clinic_admin: "is_clinic_admin",
      created_by: "created_by",
      last_modified_by: "last_modified_by",
      created_at: "created_at",
      updated_at: "updated_at",
    };

    export interface T {
      user_id: string;
      clinic_id: string;
      can_register_patients: Generated<boolean>;
      can_view_history: Generated<boolean>;
      can_edit_records: Generated<boolean>;
      can_delete_records: Generated<boolean>;
      is_clinic_admin: Generated<boolean>;
      created_by: string | null;
      last_modified_by: string | null;
      created_at: Generated<ColumnType<Date, Date | string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, Date | string | undefined, string | undefined>
      >;
    }

    export type UserClinicPermissions = Selectable<T>;
    export type NewUserClinicPermissions = Insertable<T>;
    export type UserClinicPermissionsUpdate = Updateable<T>;
  }

  export namespace API {
    /**
     * Get user permissions for a specific clinic
     * @param {string} userId - The user ID
     * @param {string} clinicId - The clinic ID
     * @returns {Promise<UserClinicPermissions.EncodedT | null>} - The user's permissions for the clinic
     */
    export const getByUserAndClinic = serverOnly(
      async (
        userId: string,
        clinicId: string,
      ): Promise<UserClinicPermissions.EncodedT | null> => {
        const result = await db
          .selectFrom(UserClinicPermissions.Table.name)
          .where("user_id", "=", userId)
          .where("clinic_id", "=", clinicId)
          .selectAll()
          .executeTakeFirst();

        return result || null;
      },
    );

    /**
     * Get all clinics where a user has a given permission
     * Similar to getClinicIdsWithPermission, except this gets all the information about the user from the cookie and does not need the parameters passed in.
     * @param permission Permission to check for
     * @returns Array of clinics where the user has the permission
     */
    export const getClinicIdsWithPermissionFromToken = serverOnly(
      async (permission: UserPermissionsT) => {
        const token = getCookie("token");
        if (!token) {
          return Promise.reject(new Error("Unauthorized"));
        }
        const userOption = await Token.getUser(token);

        if (Option.isNone(userOption)) {
          return Promise.reject(new Error("Unauthorized"));
        }

        const user = userOption.value;

        if (!user) return [];
        return getClinicIdsWithPermission(user.id, permission);
      },
    );

    /**
     * Get all clinics where a user has a given permission
     * @param userId User ID
     * @param permission Permission to check for
     * @returns Array of clinics where the user has the permission
     */
    export const getClinicIdsWithPermission = serverOnly(
      async (
        userId: string,
        permission: UserPermissionsT,
      ): Promise<string[]> => {
        const user = await db
          .selectFrom(User.Table.name)
          .selectAll()
          .where("id", "=", userId)
          .executeTakeFirst();

        if (!user) {
          return [];
        }

        const userRole = user.role;

        /// SUPER ADMIN CAN ACCESS EVERYTHING.
        if (userRole === "super_admin") {
          const ids = await db
            .selectFrom(Clinic.Table.name)
            .select("id")
            .execute();
          return ids.map((clinic) => clinic.id);
        }

        const clinics = await db
          .selectFrom(UserClinicPermissions.Table.name)
          .select("clinic_id")
          .where("user_id", "=", userId)
          .where(permission, "=", true)
          .execute();

        return clinics.map((clinic) => clinic.clinic_id);
      },
    );

    /**
     * Check if the current user (from token) is authorized to perform an action in a specific clinic
     * @param {string | null} clinicId - The clinic ID to check authorization for
     * @param {UserPermissionsT} permission - The permission to check
     * @throws {Error} Throws "Unauthorized" error if the user doesn't have the permission for the clinic
     * @returns {Promise<void>} Resolves if authorized, rejects if not
     */
    export const isAuthorizedWithClinic = serverOnly(
      async (clinicId: string | null, permission: UserPermissionsT) => {
        if (!clinicId) {
          throw new Error("Unauthorized");
        }
        const clinicIds = await getClinicIdsWithPermissionFromToken(permission);

        if (clinicId && !clinicIds.includes(clinicId)) {
          throw new Error("Unauthorized");
        }
      },
    );

    /**
     * Get all clinic permissions for a user
     * @param {string} userId - The user ID
     * @returns {Promise<UserClinicPermissions.EncodedT[]>} - All clinic permissions for the user
     */
    export const getByUser = serverOnly(
      async (userId: string): Promise<UserClinicPermissions.EncodedT[]> => {
        const result = await db
          .selectFrom(UserClinicPermissions.Table.name)
          .where("user_id", "=", userId)
          .selectAll()
          .execute();

        return result;
      },
    );

    /**
     * Get all user permissions for a clinic
     * @param {string} clinicId - The clinic ID
     * @returns {Promise<UserClinicPermissions.EncodedT[]>} - All user permissions for the clinic
     */
    export const getByClinic = serverOnly(
      async (clinicId: string): Promise<UserClinicPermissions.EncodedT[]> => {
        const result = await db
          .selectFrom(UserClinicPermissions.Table.name)
          .where("clinic_id", "=", clinicId)
          .selectAll()
          .execute();

        return result;
      },
    );

    /**
     * Create or update user clinic permissions
     * @param {Omit<UserClinicPermissions.EncodedT, 'created_by' | 'last_modified_by' | 'created_at' | 'updated_at'>} permissions - The permissions to upsert
     * @param {string} currentUserId - The ID of the user performing the operation
     * @returns {Promise<UserClinicPermissions.EncodedT>} - The created/updated permissions
     */
    export const upsert = serverOnly(
      async (
        permissions: Omit<
          UserClinicPermissions.EncodedT,
          "created_by" | "last_modified_by" | "created_at" | "updated_at"
        >,
        currentUserId: string,
      ): Promise<UserClinicPermissions.EncodedT> => {
        const result = await db
          .insertInto(UserClinicPermissions.Table.name)
          .values({
            user_id: permissions.user_id,
            clinic_id: permissions.clinic_id,
            can_register_patients: permissions.can_register_patients,
            can_view_history: permissions.can_view_history,
            can_edit_records: permissions.can_edit_records,
            can_delete_records: permissions.can_delete_records,
            is_clinic_admin: permissions.is_clinic_admin,
            created_by: currentUserId,
            last_modified_by: currentUserId,
            created_at: sql`now()::timestamp with time zone`,
            updated_at: sql`now()::timestamp with time zone`,
          })
          .onConflict((oc) =>
            oc.columns(["user_id", "clinic_id"]).doUpdateSet({
              can_register_patients: (eb) =>
                eb.ref("excluded.can_register_patients"),
              can_view_history: (eb) => eb.ref("excluded.can_view_history"),
              can_edit_records: (eb) => eb.ref("excluded.can_edit_records"),
              can_delete_records: (eb) => eb.ref("excluded.can_delete_records"),
              is_clinic_admin: (eb) => eb.ref("excluded.is_clinic_admin"),
              last_modified_by: currentUserId,
              updated_at: sql`now()::timestamp with time zone`,
            }),
          )
          .returningAll()
          .executeTakeFirstOrThrow();

        return result;
      },
    );

    /**
     * When a new clinic is created, we update all the permissions for all super_admins for that clinic
     * @param {string} clinicId
     * @param {string} currentUserId
     */
    export const newClinicCreated = serverOnly(
      async (clinicId: string, currentUserId: string) => {
        const superAdmins = await db
          .selectFrom(User.Table.name)
          .where("role", "=", User.ROLES.SUPER_ADMIN)
          .selectAll()
          .execute();

        await Promise.all(
          superAdmins.map(async (superAdmin) => {
            await db
              .insertInto(UserClinicPermissions.Table.name)
              .values({
                user_id: superAdmin.id,
                clinic_id: clinicId,
                can_register_patients: true,
                can_view_history: true,
                can_edit_records: true,
                can_delete_records: true,
                is_clinic_admin: true,
                last_modified_by: currentUserId,
                updated_at: sql`now()::timestamp with time zone`,
              })
              .executeTakeFirstOrThrow();
          }),
        );
      },
    );

    /**
     * Delete user clinic permissions
     * @param {string} userId - The user ID
     * @param {string} clinicId - The clinic ID
     * @returns {Promise<void>} - Resolves when permissions are deleted
     */
    export const remove = serverOnly(
      async (userId: string, clinicId: string): Promise<void> => {
        await db
          .deleteFrom(UserClinicPermissions.Table.name)
          .where("user_id", "=", userId)
          .where("clinic_id", "=", clinicId)
          .execute();
      },
    );

    /**
     * Check if a user has a specific permission for a clinic
     * @param {string} userId - The user ID
     * @param {string} clinicId - The clinic ID
     * @param {keyof Pick<UserClinicPermissions.T, 'can_register_patients' | 'can_view_history' | 'can_edit_records' | 'can_delete_records' | 'is_clinic_admin'>} permission - The permission to check
     * @returns {Promise<boolean>} - Whether the user has the permission
     */
    export const hasPermission = serverOnly(
      async (
        userId: string,
        clinicId: string,
        permission: keyof Pick<
          UserClinicPermissions.T,
          | "can_register_patients"
          | "can_view_history"
          | "can_edit_records"
          | "can_delete_records"
          | "is_clinic_admin"
        >,
      ): Promise<boolean> => {
        const result = await db
          .selectFrom(UserClinicPermissions.Table.name)
          .where("user_id", "=", userId)
          .where("clinic_id", "=", clinicId)
          .select([permission])
          .executeTakeFirst();

        return result?.[permission] || false;
      },
    );

    /**
     * Set a permission flag for a given user and a given clinic
     * @param {string} userId - The user ID
     * @param {string} clinicId - The clinic ID
     * @param {keyof Pick<UserClinicPermissions.T, 'can_register_patients' | 'can_view_history' | 'can_edit_records' | 'can_delete_records' | 'is_clinic_admin'>} permission - The permission to check
     * @param {boolean} value - The value to set the permission to
     * @returns {Promise<void>}
     */
    export const setPermission = serverOnly(
      async (
        userId: string,
        clinicId: string,
        permission: keyof Pick<
          UserClinicPermissions.T,
          | "can_register_patients"
          | "can_view_history"
          | "can_edit_records"
          | "can_delete_records"
          | "is_clinic_admin"
        >,
        value: boolean,
      ): Promise<void> => {
        await db
          .updateTable(UserClinicPermissions.Table.name)
          .where("user_id", "=", userId)
          .where("clinic_id", "=", clinicId)
          .set({ [permission]: value })
          .execute();
      },
    );

    /**
     * Get all clinic admins for a clinic
     * @param {string} clinicId - The clinic ID
     * @returns {Promise<UserClinicPermissions.EncodedT[]>} - All clinic admins
     */
    export const getClinicAdmins = serverOnly(
      async (clinicId: string): Promise<UserClinicPermissions.EncodedT[]> => {
        const result = await db
          .selectFrom(UserClinicPermissions.Table.name)
          .where("clinic_id", "=", clinicId)
          .where("is_clinic_admin", "=", true)
          .selectAll()
          .execute();

        return result;
      },
    );
  }
}

export default UserClinicPermissions;
