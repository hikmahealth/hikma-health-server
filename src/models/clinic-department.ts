import db from "@/db";
import { Either, Option, Schema } from "effect";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  sql,
} from "kysely";
import { serverOnly } from "@tanstack/react-start";
import { v1 as uuidV1 } from "uuid";
import { safeJSONParse } from "@/lib/utils";

namespace ClinicDepartment {
  // Status constants
  export const STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    MAINTENANCE: "maintenance",
  } as const;

  export const statuses = [
    STATUS.ACTIVE,
    STATUS.INACTIVE,
    STATUS.MAINTENANCE,
  ] as const;

  export const StatusSchema = Schema.Union(
    Schema.Literal(STATUS.ACTIVE),
    Schema.Literal(STATUS.INACTIVE),
    Schema.Literal(STATUS.MAINTENANCE),
  );

  export type StatusT = typeof StatusSchema.Type;

  // Additional capabilities as an array of strings
  export const AdditionalCapabilitiesSchema = Schema.Array(Schema.String);

  export const ClinicDepartmentSchema = Schema.Struct({
    id: Schema.String,
    clinic_id: Schema.String,
    name: Schema.String,
    code: Schema.OptionFromNullOr(Schema.String),
    description: Schema.OptionFromNullOr(Schema.String),
    status: StatusSchema,
    can_dispense_medications: Schema.Boolean,
    can_perform_labs: Schema.Boolean,
    can_perform_imaging: Schema.Boolean,
    additional_capabilities: AdditionalCapabilitiesSchema,
    metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    is_deleted: Schema.Boolean,
    created_at: Schema.Union(
      Schema.DateFromString,
      Schema.Date,
      Schema.DateFromSelf,
    ),
    updated_at: Schema.Union(
      Schema.Date,
      Schema.DateFromString,
      Schema.DateFromSelf,
    ),
    last_modified: Schema.Union(
      Schema.Date,
      Schema.DateFromString,
      Schema.DateFromSelf,
    ),
    server_created_at: Schema.Union(
      Schema.Date,
      Schema.DateFromString,
      Schema.DateFromSelf,
    ),
    deleted_at: Schema.OptionFromNullOr(
      Schema.Union(Schema.Date, Schema.DateFromString),
    ),
  });

  export type T = typeof ClinicDepartmentSchema.Type;
  export type EncodedT = typeof ClinicDepartmentSchema.Encoded;

  export type DepartmentCapability =
    | "can_dispense_medications"
    | "can_perform_labs"
    | "can_perform_imaging";

  export const fromDbEntry = (
    dbDepartment: ClinicDepartment.Table.Departments,
  ): Either.Either<ClinicDepartment.T, Error> => {
    return Schema.decodeUnknownEither(ClinicDepartmentSchema)(dbDepartment);
  };

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = true;
    export const name = "clinic_departments";
    /** The name of the table in the mobile database */
    export const mobileName = "clinic_departments";
    export const columns = {
      id: "id",
      clinic_id: "clinic_id",
      name: "name",
      code: "code",
      description: "description",
      status: "status",
      can_dispense_medications: "can_dispense_medications",
      can_perform_labs: "can_perform_labs",
      can_perform_imaging: "can_perform_imaging",
      additional_capabilities: "additional_capabilities",
      metadata: "metadata",
      is_deleted: "is_deleted",
      created_at: "created_at",
      updated_at: "updated_at",
      last_modified: "last_modified",
      server_created_at: "server_created_at",
      deleted_at: "deleted_at",
    };

    export interface T {
      id: string;
      clinic_id: string;
      name: string;
      code: string | null;
      description: string | null;
      status: Generated<string>;
      can_dispense_medications: Generated<boolean>;
      can_perform_labs: Generated<boolean>;
      can_perform_imaging: Generated<boolean>;
      additional_capabilities: Generated<
        ColumnType<any[], any[] | undefined, any[]>
      >;
      metadata: Generated<
        ColumnType<
          Record<string, any>,
          Record<string, any> | undefined,
          Record<string, any>
        >
      >;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<ColumnType<Date, string | undefined, never>>;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }

    export type Departments = Selectable<T>;
    export type NewDepartments = Insertable<T>;
    export type DepartmentsUpdate = Updateable<T>;
  }

  export namespace API {
    /**
     * Upserts a department
     * @param {ClinicDepartment.EncodedT} department - The department to update
     * @returns {Promise<ClinicDepartment.EncodedT["id"] | null>} - The updated department ID
     */
    export const upsert = serverOnly(
      async (
        department: Omit<
          ClinicDepartment.EncodedT,
          | "id"
          | "created_at"
          | "updated_at"
          | "last_modified"
          | "server_created_at"
          | "deleted_at"
        >,
      ): Promise<ClinicDepartment.EncodedT["id"] | null> => {
        const departmentId = uuidV1();

        await db
          .insertInto(Table.name)
          .values({
            id: departmentId,
            clinic_id: department.clinic_id,
            name: department.name,
            code: department.code,
            description: department.description,
            status: department.status,
            can_dispense_medications: department.can_dispense_medications,
            can_perform_labs: department.can_perform_labs,
            can_perform_imaging: department.can_perform_imaging,
            additional_capabilities: sql`${JSON.stringify(
              safeJSONParse(department.additional_capabilities, []),
            )}::jsonb`,
            metadata: sql`${JSON.stringify(
              safeJSONParse(department.metadata, {}),
            )}::jsonb`,
            is_deleted: department.is_deleted || false,
            created_at: sql`now()`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
            server_created_at: sql`now()`,
            deleted_at: null,
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              clinic_id: department.clinic_id,
              name: department.name,
              code: department.code,
              description: department.description,
              status: department.status,
              can_dispense_medications: department.can_dispense_medications,
              can_perform_labs: department.can_perform_labs,
              can_perform_imaging: department.can_perform_imaging,
              additional_capabilities: sql`${JSON.stringify(
                safeJSONParse(department.additional_capabilities, []),
              )}::jsonb`,
              metadata: sql`${JSON.stringify(
                safeJSONParse(department.metadata, {}),
              )}::jsonb`,
              is_deleted: department.is_deleted || false,
              updated_at: sql`now()::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
            }),
          )
          .execute();

        return departmentId;
      },
    );

    /**
     * Get all departments
     * @param {string} clinicId - Optional clinic ID to filter by
     * @returns {Promise<ClinicDepartment.EncodedT[]>} - The list of departments
     */
    export const getAll = serverOnly(
      async (clinicId?: string): Promise<ClinicDepartment.EncodedT[]> => {
        let query = db
          .selectFrom(Table.name)
          .where("is_deleted", "=", false)
          .selectAll();

        if (clinicId) {
          query = query.where("clinic_id", "=", clinicId);
        }

        const departments = await query.execute();

        const entries = departments.map(ClinicDepartment.fromDbEntry);

        return entries
          .filter(Either.isRight)
          .map((e) => Schema.encodeSync(ClinicDepartmentSchema)(e.right));
      },
    );

    /**
     * Get all active departments for a clinic
     * @param {string} clinicId - The clinic ID
     * @returns {Promise<ClinicDepartment.EncodedT[]>} - The list of active departments
     */
    export const getActiveByClinicId = serverOnly(
      async (clinicId: string): Promise<ClinicDepartment.EncodedT[]> => {
        const departments = await db
          .selectFrom(Table.name)
          .where("clinic_id", "=", clinicId)
          .where("status", "=", STATUS.ACTIVE)
          .where("is_deleted", "=", false)
          .selectAll()
          .execute();

        const entries = departments.map(ClinicDepartment.fromDbEntry);

        return entries
          .filter(Either.isRight)
          .map((e) => Schema.encodeSync(ClinicDepartmentSchema)(e.right));
      },
    );

    /**
     * Get a department by its ID
     * @param {string} id - The ID of the department
     * @returns {Promise<ClinicDepartment.EncodedT | null>} - The department
     */
    export const getById = serverOnly(
      async (id: string): Promise<ClinicDepartment.EncodedT | null> => {
        const department = await db
          .selectFrom(Table.name)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .selectAll()
          .executeTakeFirst();

        if (!department) return null;

        const entry = ClinicDepartment.fromDbEntry(department);
        if (Either.isLeft(entry)) return null;

        return Schema.encodeSync(ClinicDepartmentSchema)(entry.right);
      },
    );

    /**
     * Get a department by its code within a clinic
     * @param {string} clinicId - The clinic ID
     * @param {string} code - The department code
     * @returns {Promise<ClinicDepartment.EncodedT | null>} - The department
     */
    export const getByCode = serverOnly(
      async (
        clinicId: string,
        code: string,
      ): Promise<ClinicDepartment.EncodedT | null> => {
        const department = await db
          .selectFrom(Table.name)
          .where("clinic_id", "=", clinicId)
          .where("code", "=", code)
          .where("is_deleted", "=", false)
          .selectAll()
          .executeTakeFirst();

        if (!department) return null;

        const entry = ClinicDepartment.fromDbEntry(department);
        if (Either.isLeft(entry)) return null;

        return Schema.encodeSync(ClinicDepartmentSchema)(entry.right);
      },
    );

    /**
     * Soft delete a department
     * @param {string} id - The ID of the department to delete
     * @returns {Promise<void>}
     */
    export const softDelete = serverOnly(async (id: string): Promise<void> => {
      await db
        .updateTable(Table.name)
        .set({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          updated_at: sql`now()`,
          last_modified: sql`now()`,
        })
        .where("id", "=", id)
        .execute();
    });

    /**
     * Update department status
     * @param {string} id - The ID of the department
     * @param {StatusT} status - The new status
     * @returns {Promise<void>}
     */
    export const updateStatus = serverOnly(
      async (id: string, status: StatusT): Promise<void> => {
        await db
          .updateTable(Table.name)
          .set({
            status,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .execute();
      },
    );

    /**
     * Toggle a capability of the department
     * @param {string} departmentId
     * @param {DepartmentCapability} capability to be toggled
     */
    export const toggleCapability = serverOnly(
      async (
        departmentId: string,
        capability: DepartmentCapability,
      ): Promise<void> => {
        await db
          .updateTable(Table.name)
          .set((eb) => ({
            [capability]: eb.not(capability),
            // [capability]: sql`not ${capability}`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          }))
          .where("id", "=", departmentId)
          .execute();
      },
    );

    /**
     * Get departments with specific capabilities
     * @param {string} clinicId - The clinic ID
     * @param {object} capabilities - The capabilities to filter by
     * @returns {Promise<ClinicDepartment.EncodedT[]>} - The list of departments
     */
    export const getByCapabilities = serverOnly(
      async (
        clinicId: string,
        capabilities: {
          canDispenseMedications?: boolean;
          canPerformLabs?: boolean;
          canPerformImaging?: boolean;
        },
      ): Promise<ClinicDepartment.EncodedT[]> => {
        let query = db
          .selectFrom(Table.name)
          .where("clinic_id", "=", clinicId)
          .where("status", "=", STATUS.ACTIVE)
          .where("is_deleted", "=", false);

        if (capabilities.canDispenseMedications !== undefined) {
          query = query.where(
            "can_dispense_medications",
            "=",
            capabilities.canDispenseMedications,
          );
        }
        if (capabilities.canPerformLabs !== undefined) {
          query = query.where(
            "can_perform_labs",
            "=",
            capabilities.canPerformLabs,
          );
        }
        if (capabilities.canPerformImaging !== undefined) {
          query = query.where(
            "can_perform_imaging",
            "=",
            capabilities.canPerformImaging,
          );
        }

        const departments = await query.selectAll().execute();

        const entries = departments.map(ClinicDepartment.fromDbEntry);

        return entries
          .filter(Either.isRight)
          .map((e) => Schema.encodeSync(ClinicDepartmentSchema)(e.right));
      },
    );
  }

  /**
   * Helper function to check if a department has a specific capability
   * @param {ClinicDepartment.T | ClinicDepartment.EncodedT} department - The department
   * @param {string} capability - The capability to check
   * @returns {boolean} - Whether the department has the capability
   */
  export function hasCapability(
    department: ClinicDepartment.T | ClinicDepartment.EncodedT,
    capability: string,
  ): boolean {
    // Check core capabilities
    switch (capability) {
      case "dispense_medications":
        return department.can_dispense_medications;
      case "perform_labs":
        return department.can_perform_labs;
      case "perform_imaging":
        return department.can_perform_imaging;
      default:
        // Check additional capabilities
        return department.additional_capabilities.includes(capability);
    }
  }

  /**
   * Helper function to get department display code
   * @param {ClinicDepartment.T | ClinicDepartment.EncodedT} department - The department
   * @returns {string} - The department code or abbreviated name
   */
  export function getDisplayCode(
    department: ClinicDepartment.T | ClinicDepartment.EncodedT,
  ): string {
    if (Option.isOption(department.code)) {
      const code = department.code;
      return Option.match(code, {
        onSome: (code) => code.toUpperCase(),
        onNone: () => "Unknown",
      });
    }

    // Generate code from name if no code exists
    return department.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 4);
  }

  export namespace Sync {
    export const upsertFromDelta = serverOnly(async (delta: EncodedT) => {
      return API.upsert(delta);
    });

    export const deleteFromDelta = serverOnly(async (id: string) => {
      return Promise.resolve(id);
    });
  }
}

export default ClinicDepartment;
