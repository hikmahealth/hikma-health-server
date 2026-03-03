import db from "@/db";
import {
  DatabaseError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type DomainError,
} from "@/db/helpers";
import { createServerOnlyFn } from "@tanstack/react-start";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  sql,
  Transaction,
} from "kysely";
import { isValidUUID } from "@/lib/utils";
import UserClinicPermissions from "./user-clinic-permissions";
import { v1 as uuidV1 } from "uuid";

// ============ VALIDATION HELPERS ============

const validateItemId = (id: unknown): string => {
  if (typeof id !== "string" || !isValidUUID(id)) {
    throw new ValidationError("Invalid prescription item ID format");
  }
  return id;
};

const validatePrescriptionId = (id: unknown): string => {
  if (typeof id !== "string" || !isValidUUID(id)) {
    throw new ValidationError("Invalid prescription ID format");
  }
  return id;
};

const validatePatientId = (id: unknown): string => {
  if (typeof id !== "string" || !isValidUUID(id)) {
    throw new ValidationError("Invalid patient ID format");
  }
  return id;
};

const validateDrugId = (id: unknown): string => {
  if (typeof id !== "string" || !isValidUUID(id)) {
    throw new ValidationError("Invalid drug ID format");
  }
  return id;
};

const validateClinicId = (id: unknown): string => {
  if (typeof id !== "string" || !isValidUUID(id)) {
    throw new ValidationError("Invalid clinic ID format");
  }
  return id;
};

const validateQuantity = (quantity: unknown): number => {
  if (typeof quantity !== "number" || quantity < 0) {
    throw new ValidationError(
      "Invalid quantity - must be a non-negative number",
    );
  }
  return quantity;
};

const validatePagination = ({
  limit = 50,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
}): { limit: number; offset: number } => {
  if (!(limit > 0 && limit <= 1000 && offset >= 0 && offset < 1000000)) {
    throw new ValidationError("Invalid pagination parameters");
  }
  return { limit, offset };
};

namespace PrescriptionItem {
  export type Item = Selectable<Table.T>;
  export type NewItem = Insertable<Table.T>;
  export type ItemUpdate = Updateable<Table.T>;

  // API response type
  export type ApiPrescriptionItem = {
    id: string;
    prescription_id: string;
    patient_id: string;
    drug_id: string;
    clinic_id: string;
    dosage_instructions: string;
    quantity_prescribed: number;
    quantity_dispensed: number;
    refills_authorized: number;
    refills_used: number;
    item_status: string;
    notes: string | null;
  };

  export namespace Table {
    export const ALWAYS_PUSH_TO_MOBILE = true;
    export const name = "prescription_items";
    export const mobileName = "prescription_items";
    export const columns = {
      id: "id",
      prescription_id: "prescription_id",
      patient_id: "patient_id",
      drug_id: "drug_id",
      clinic_id: "clinic_id",
      dosage_instructions: "dosage_instructions",
      quantity_prescribed: "quantity_prescribed",
      quantity_dispensed: "quantity_dispensed",
      refills_authorized: "refills_authorized",
      refills_used: "refills_used",
      item_status: "item_status",
      notes: "notes",
      recorded_by_user_id: "recorded_by_user_id",
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
      prescription_id: string;
      patient_id: string;
      drug_id: string;
      clinic_id: string;
      dosage_instructions: string;
      quantity_prescribed: number;
      quantity_dispensed: Generated<number>;
      refills_authorized: Generated<number>;
      refills_used: Generated<number>;
      item_status: Generated<string>;
      notes: string | null;
      recorded_by_user_id: string | null;
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

    export type PrescriptionItem = Selectable<T>;
    export type NewPrescriptionItem = Insertable<T>;
    export type PrescriptionItemUpdate = Updateable<T>;
  }

  // ============ QUERY BUILDERS ============

  const baseQuery = () => db.selectFrom(Table.name);

  // ============ PERMISSION CHECKING ============

  const checkPrescriptionPermission = async (
    clinicId: string,
  ): Promise<void> => {
    try {
      const clinicIds =
        await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
          "is_clinic_admin",
        );
      if (!clinicIds.includes(clinicId)) {
        throw new UnauthorizedError("No permission for this clinic");
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new DatabaseError("Failed to check permissions", error);
    }
  };

  export namespace API {
    export const getById = createServerOnlyFn(
      async (id: string): Promise<ApiPrescriptionItem | undefined> => {
        const validId = validateItemId(id);
        const result = await baseQuery()
          .selectAll()
          .where("id", "=", validId)
          .executeTakeFirst();
        return result as ApiPrescriptionItem | undefined;
      },
    );

    export const getByPrescriptionId = createServerOnlyFn(
      async (
        prescriptionId: string,
        params: { limit?: number; offset?: number } = {},
      ): Promise<ApiPrescriptionItem[]> => {
        const validPrescriptionId = validatePrescriptionId(prescriptionId);
        const { limit, offset } = validatePagination(params);

        const results = await baseQuery()
          .selectAll()
          .where("prescription_id", "=", validPrescriptionId)
          .orderBy("id", "asc")
          .limit(limit)
          .offset(offset)
          .execute();

        return results as ApiPrescriptionItem[];
      },
    );

    export const getByPatientId = createServerOnlyFn(
      async (
        patientId: string,
        params: { status?: string; limit?: number; offset?: number } = {},
      ): Promise<ApiPrescriptionItem[]> => {
        const validPatientId = validatePatientId(patientId);
        const { limit, offset } = validatePagination(params);

        let query = baseQuery()
          .selectAll()
          .where("patient_id", "=", validPatientId);

        if (params.status) {
          query = query.where("item_status", "=", params.status);
        }

        const results = await query
          .orderBy("id", "desc")
          .limit(limit)
          .offset(offset)
          .execute();

        return results as ApiPrescriptionItem[];
      },
    );

    export const getByClinicId = createServerOnlyFn(
      async (
        clinicId: string,
        params: { status?: string; limit?: number; offset?: number } = {},
      ): Promise<ApiPrescriptionItem[]> => {
        const validClinicId = validateClinicId(clinicId);
        const { limit, offset } = validatePagination(params);

        let query = baseQuery()
          .selectAll()
          .where("clinic_id", "=", validClinicId);

        if (params.status) {
          query = query.where("item_status", "=", params.status);
        }

        const results = await query
          .orderBy("id", "desc")
          .limit(limit)
          .offset(offset)
          .execute();

        return results as ApiPrescriptionItem[];
      },
    );

    export const getActiveItemsForPatient = createServerOnlyFn(
      async (patientId: string): Promise<ApiPrescriptionItem[]> => {
        const validPatientId = validatePatientId(patientId);

        const results = await baseQuery()
          .selectAll()
          .where("patient_id", "=", validPatientId)
          .where("item_status", "=", "active")
          .orderBy("id", "desc")
          .execute();

        return results as ApiPrescriptionItem[];
      },
    );

    const buildUpsertValues = (
      item: Partial<ApiPrescriptionItem>,
      id: string,
    ) => ({
      id,
      prescription_id: item.prescription_id || "",
      patient_id: item.patient_id || "",
      drug_id: item.drug_id || "",
      clinic_id: item.clinic_id || "",
      dosage_instructions: item.dosage_instructions || "",
      quantity_prescribed: item.quantity_prescribed || 0,
      quantity_dispensed: item.quantity_dispensed ?? 0,
      refills_authorized: item.refills_authorized ?? 0,
      refills_used: item.refills_used ?? 0,
      item_status: item.item_status ?? "active",
      notes: item.notes ?? null,
    });

    const executeCoreUpsert = async (
      item: Partial<ApiPrescriptionItem>,
      trx: Transaction<any>,
    ): Promise<{ id: string }> => {
      const id = item.id || uuidV1();
      const values = buildUpsertValues(item, id);

      try {
        const result = await trx
          .insertInto(Table.name)
          .values(values)
          .onConflict((oc) =>
            oc.column("id").doUpdateSet((eb) => ({
              prescription_id: eb.ref("excluded.prescription_id"),
              patient_id: eb.ref("excluded.patient_id"),
              drug_id: eb.ref("excluded.drug_id"),
              clinic_id: eb.ref("excluded.clinic_id"),
              dosage_instructions: eb.ref("excluded.dosage_instructions"),
              quantity_prescribed: eb.ref("excluded.quantity_prescribed"),
              quantity_dispensed: eb.ref("excluded.quantity_dispensed"),
              refills_authorized: eb.ref("excluded.refills_authorized"),
              refills_used: eb.ref("excluded.refills_used"),
              item_status: eb.ref("excluded.item_status"),
              notes: eb.ref("excluded.notes"),
            })),
          )
          .returning("id")
          .executeTakeFirstOrThrow();

        return result;
      } catch (error) {
        console.error("Error: ", error);
        throw new DatabaseError("Upsert failed", error);
      }
    };

    export const upsert = createServerOnlyFn(
      async (item: Partial<ApiPrescriptionItem>): Promise<{ id: string }> => {
        if (item.clinic_id) {
          await checkPrescriptionPermission(item.clinic_id);
        }

        try {
          return await db.transaction().execute(async (trx) => {
            return await executeCoreUpsert(item, trx);
          });
        } catch (error) {
          throw new DatabaseError("Transaction failed", error);
        }
      },
    );

    export const DANGEROUS_SYNC_ONLY_upsert = createServerOnlyFn(
      async (item: Partial<ApiPrescriptionItem>): Promise<{ id: string }> => {
        try {
          return await db.transaction().execute(async (trx) => {
            return await executeCoreUpsert(item, trx);
          });
        } catch (error) {
          throw new DatabaseError("Transaction failed", error);
        }
      },
    );

    export const updateQuantityDispensed = createServerOnlyFn(
      async (
        id: string,
        quantityToAdd: number,
      ): Promise<ApiPrescriptionItem> => {
        const validId = validateItemId(id);
        const validQuantity = validateQuantity(quantityToAdd);

        try {
          return await db.transaction().execute(async (trx) => {
            // Get current item
            const current = await trx
              .selectFrom(Table.name)
              .selectAll()
              .where("id", "=", validId)
              .executeTakeFirstOrThrow();

            const typedCurrent = current as ApiPrescriptionItem;
            const newQuantityDispensed =
              typedCurrent.quantity_dispensed + validQuantity;
            const newRefillsUsed = Math.floor(
              newQuantityDispensed / typedCurrent.quantity_prescribed,
            );

            // Update the item
            const result = await trx
              .updateTable(Table.name)
              .set({
                quantity_dispensed: newQuantityDispensed,
                refills_used: newRefillsUsed,
                item_status:
                  newQuantityDispensed >=
                  typedCurrent.quantity_prescribed *
                    (typedCurrent.refills_authorized + 1)
                    ? "completed"
                    : "active",
              })
              .where("id", "=", validId)
              .returningAll()
              .executeTakeFirstOrThrow();

            return result as ApiPrescriptionItem;
          });
        } catch (error) {
          throw new DatabaseError("Update quantity dispensed failed", error);
        }
      },
    );

    export const updateStatus = createServerOnlyFn(
      async (
        id: string,
        status: "active" | "completed" | "cancelled" | "partially_dispensed",
      ): Promise<ApiPrescriptionItem> => {
        const validId = validateItemId(id);

        try {
          const result = await db
            .updateTable(Table.name)
            .set({ item_status: status })
            .where("id", "=", validId)
            .returningAll()
            .executeTakeFirstOrThrow();

          return result as ApiPrescriptionItem;
        } catch (error) {
          throw new DatabaseError("Update status failed", error);
        }
      },
    );

    export const batchGetByIds = createServerOnlyFn(
      async (ids: string[]): Promise<ApiPrescriptionItem[]> => {
        if (ids.length === 0) return [];
        if (ids.length > 100) {
          throw new ValidationError(
            "Cannot batch get more than 100 items at once",
          );
        }

        const validIds = ids.map(validateItemId);

        try {
          const results = await baseQuery()
            .selectAll()
            .where("id", "in", validIds)
            .execute();

          return results as ApiPrescriptionItem[];
        } catch (error) {
          throw new DatabaseError("Batch get failed", error);
        }
      },
    );

    export const getStats = createServerOnlyFn(
      async (
        clinicId: string,
      ): Promise<{
        totalItems: number;
        activeItems: number;
        completedItems: number;
        totalQuantityPrescribed: number;
        totalQuantityDispensed: number;
      }> => {
        const validClinicId = validateClinicId(clinicId);

        try {
          const result = await db
            .selectFrom(Table.name)
            .select([
              sql<number>`COUNT(*)`.as("totalItems"),
              sql<number>`COUNT(*) FILTER (WHERE item_status = 'active')`.as(
                "activeItems",
              ),
              sql<number>`COUNT(*) FILTER (WHERE item_status = 'completed')`.as(
                "completedItems",
              ),
              sql<number>`COALESCE(SUM(quantity_prescribed), 0)`.as(
                "totalQuantityPrescribed",
              ),
              sql<number>`COALESCE(SUM(quantity_dispensed), 0)`.as(
                "totalQuantityDispensed",
              ),
            ])
            .where("clinic_id", "=", validClinicId)
            .executeTakeFirstOrThrow();

          return {
            totalItems: Number(result.totalItems) || 0,
            activeItems: Number(result.activeItems) || 0,
            completedItems: Number(result.completedItems) || 0,
            totalQuantityPrescribed:
              Number(result.totalQuantityPrescribed) || 0,
            totalQuantityDispensed: Number(result.totalQuantityDispensed) || 0,
          };
        } catch (error) {
          throw new DatabaseError("Get stats failed", error);
        }
      },
    );
  }

  export namespace Sync {
    export const upsertFromDelta = createServerOnlyFn(
      async (item: Partial<ApiPrescriptionItem>): Promise<{ id: string }> => {
        return API.DANGEROUS_SYNC_ONLY_upsert(item);
      },
    );

    export const deleteFromDelta = createServerOnlyFn(
      async (id: string): Promise<void> => {
        const validId = validateItemId(id);

        try {
          await db.deleteFrom(Table.name).where("id", "=", validId).execute();
        } catch (error) {
          throw new DatabaseError("Delete failed", error);
        }
      },
    );
  }
}

export default PrescriptionItem;
