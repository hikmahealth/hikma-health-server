import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
import { Option } from "effect";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  sql,
} from "kysely";
import { toSafeDateString } from "@/lib/utils";
import UserClinicPermissions from "./user-clinic-permissions";
import { v1 as uuidV1 } from "uuid";

namespace InventoryTransactions {
  export type T = {
    id: string;
    clinic_id: string;
    drug_id: string;
    batch_id: Option.Option<string>;
    transaction_type: string;
    quantity: number;
    balance_after: number;
    reference_type: Option.Option<string>;
    reference_id: Option.Option<string>;
    reason: Option.Option<string>;
    performed_by: Option.Option<string>;
    timestamp: Date;
    created_at: Date;
    updated_at: Date;
  };

  export type EncodedT = {
    id: string;
    clinic_id: string;
    drug_id: string;
    batch_id: string | null;
    transaction_type: string;
    quantity: number;
    balance_after: number;
    reference_type: string | null;
    reference_id: string | null;
    reason: string | null;
    performed_by: string | null;
    timestamp: Date;
    created_at: Date;
    updated_at: Date;
  };

  export const TransactionTypes = {
    RECEIVED: "received",
    DISPENSED: "dispensed",
    TRANSFERRED_IN: "transferred_in",
    TRANSFERRED_OUT: "transferred_out",
    EXPIRED: "expired",
    DAMAGED: "damaged",
    ADJUSTMENT: "adjustment",
    RETURNED: "returned",
  } as const;

  export type TransactionType =
    (typeof TransactionTypes)[keyof typeof TransactionTypes];

  export const ReferenceTypes = {
    DISPENSING_RECORD: "dispensing_record",
    STOCK_ORDER: "stock_order",
    TRANSFER_ORDER: "transfer_order",
    ADJUSTMENT_RECORD: "adjustment_record",
  } as const;

  export type ReferenceType =
    (typeof ReferenceTypes)[keyof typeof ReferenceTypes];

  export namespace Table {
    /**
     * This is a server-only table for audit logging of inventory movements.
     * Never synced to mobile clients.
     */
    export const ALWAYS_PUSH_TO_MOBILE = false;
    export const name = "inventory_transactions";
    /** This table doesn't exist on mobile */
    export const mobileName = null;

    export const columns = {
      id: "id",
      clinic_id: "clinic_id",
      drug_id: "drug_id",
      batch_id: "batch_id",
      transaction_type: "transaction_type",
      quantity: "quantity",
      balance_after: "balance_after",
      reference_type: "reference_type",
      reference_id: "reference_id",
      reason: "reason",
      performed_by: "performed_by",
      timestamp: "timestamp",
      created_at: "created_at",
      updated_at: "updated_at",
    };

    export interface T {
      id: string;
      clinic_id: string;
      drug_id: string;
      batch_id: string | null;
      transaction_type: string;
      quantity: number;
      balance_after: number;
      reference_type: string | null;
      reference_id: string | null;
      reason: string | null;
      performed_by: string | null;
      timestamp: ColumnType<Date, string | undefined, string | undefined>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
    }

    export type InventoryTransactions = Selectable<T>;
    export type NewInventoryTransactions = Insertable<T>;
    export type InventoryTransactionsUpdate = Updateable<T>;
  }

  export namespace API {
    /**
     * Insert a new inventory transaction.
     * This is typically called automatically by other inventory operations.
     */
    export const insert = serverOnly(
      async (transaction: Partial<EncodedT>): Promise<{ id: string }> => {
        // Permissions check - user must have inventory management permission for the clinic
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "can_manage_inventory",
          );

        if (!transaction.clinic_id) {
          throw new Error("Clinic ID is required");
        }

        if (!clinicIds.includes(transaction.clinic_id)) {
          throw new Error(
            "Unauthorized: No inventory management permissions for this clinic",
          );
        }

        return await insert_core(transaction);
      },
    );

    /**
     * Insert without permission checks - for internal use only
     * Used by other models that need to record transactions
     */
    export const DANGEROUS_INTERNAL_ONLY_insert = serverOnly(
      async (transaction: Partial<EncodedT>): Promise<{ id: string }> => {
        return await insert_core(transaction);
      },
    );

    const insert_core = serverOnly(
      async (transaction: Partial<EncodedT>): Promise<{ id: string }> => {
        if (!transaction.clinic_id || !transaction.drug_id) {
          throw new Error("Clinic ID and Drug ID are required");
        }

        if (
          transaction.quantity === undefined ||
          transaction.balance_after === undefined
        ) {
          throw new Error("Quantity and balance_after are required");
        }

        if (!transaction.transaction_type) {
          throw new Error("Transaction type is required");
        }

        const id = transaction.id || uuidV1();

        const result = await db
          .insertInto(Table.name)
          .values({
            id,
            clinic_id: transaction.clinic_id,
            drug_id: transaction.drug_id,
            batch_id: transaction.batch_id || null,
            transaction_type: transaction.transaction_type,
            quantity: transaction.quantity,
            balance_after: transaction.balance_after,
            reference_type: transaction.reference_type || null,
            reference_id: transaction.reference_id || null,
            reason: transaction.reason || null,
            performed_by: transaction.performed_by || null,
            timestamp: transaction.timestamp
              ? sql`${toSafeDateString(
                  transaction.timestamp,
                )}::timestamp with time zone`
              : sql`now()::timestamp with time zone`,
            created_at: transaction.created_at
              ? sql`${toSafeDateString(
                  transaction.created_at,
                )}::timestamp with time zone`
              : sql`now()::timestamp with time zone`,
            updated_at: transaction.updated_at
              ? sql`${toSafeDateString(
                  transaction.updated_at,
                )}::timestamp with time zone`
              : sql`now()::timestamp with time zone`,
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        return result;
      },
    );

    /**
     * Update an existing inventory transaction.
     * Limited to updating reason, reference fields, and metadata.
     * Cannot change quantity, balance, or core transaction details.
     */
    export const update = serverOnly(
      async (
        id: string,
        updates: {
          reason?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
        },
      ): Promise<void> => {
        // Get the transaction to verify clinic access
        const transaction = await db
          .selectFrom(Table.name)
          .select(["clinic_id"])
          .where("id", "=", id)
          .executeTakeFirst();

        if (!transaction) {
          throw new Error("Transaction not found");
        }

        // Permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "can_manage_inventory",
          );

        if (!clinicIds.includes(transaction.clinic_id)) {
          throw new Error(
            "Unauthorized: No inventory management permissions for this clinic",
          );
        }

        await update_core(id, updates);
      },
    );

    /**
     * Update without permission checks - for internal use only
     */
    export const DANGEROUS_INTERNAL_ONLY_update = serverOnly(
      async (
        id: string,
        updates: {
          reason?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
        },
      ): Promise<void> => {
        await update_core(id, updates);
      },
    );

    const update_core = serverOnly(
      async (
        id: string,
        updates: {
          reason?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
        },
      ): Promise<void> => {
        await db
          .updateTable(Table.name)
          .set({
            reason: updates.reason !== undefined ? updates.reason : undefined,
            reference_type:
              updates.reference_type !== undefined
                ? updates.reference_type
                : undefined,
            reference_id:
              updates.reference_id !== undefined
                ? updates.reference_id
                : undefined,
            updated_at: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", id)
          .execute();
      },
    );

    /**
     * Soft delete an inventory transaction.
     * Note: This table doesn't have is_deleted/deleted_at columns in the migration,
     * so this would need to be a hard delete or the migration needs updating.
     * For now, implementing as a no-op with a warning.
     */
    export const softDelete = serverOnly(async (id: string) => {
      // Since the inventory_transactions table doesn't have soft delete columns in the migration,
      // we'll throw an error to indicate this operation is not supported
      throw new Error(
        "Soft delete is not supported for inventory transactions. " +
          "These records should be preserved for audit purposes.",
      );
    });

    /**
     * Get transactions by clinic
     */
    export const getByClinic = serverOnly(
      async (
        clinicId: string,
        {
          limit = 50,
          offset = 0,
          startDate,
          endDate,
          transactionType,
          drugId,
        }: {
          limit?: number;
          offset?: number;
          startDate?: Date;
          endDate?: Date;
          transactionType?: TransactionType;
          drugId?: string;
        } = {},
      ): Promise<EncodedT[]> => {
        // Permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "can_view_reports",
          );

        if (!clinicIds.includes(clinicId)) {
          throw new Error(
            "Unauthorized: No permission to view reports for this clinic",
          );
        }

        let query = db
          .selectFrom(Table.name)
          .selectAll()
          .where("clinic_id", "=", clinicId);

        if (startDate) {
          query = query.where(
            "timestamp",
            ">=",
            sql`${toSafeDateString(startDate)}::timestamp with time zone`,
          );
        }

        if (endDate) {
          query = query.where(
            "timestamp",
            "<=",
            sql`${toSafeDateString(endDate)}::timestamp with time zone`,
          );
        }

        if (transactionType) {
          query = query.where("transaction_type", "=", transactionType);
        }

        if (drugId) {
          query = query.where("drug_id", "=", drugId);
        }

        const results = await query
          .orderBy("timestamp", "desc")
          .limit(limit)
          .offset(offset)
          .execute();

        return results as EncodedT[];
      },
    );

    /**
     * Get transaction details with drug information
     */
    export const getWithDrugInfo = serverOnly(
      async (
        clinicId: string,
        options: {
          limit?: number;
          offset?: number;
          startDate?: Date;
          endDate?: Date;
          transactionType?: TransactionType;
        } = {},
      ): Promise<any[]> => {
        // Permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "can_view_reports",
          );

        if (!clinicIds.includes(clinicId)) {
          throw new Error(
            "Unauthorized: No permission to view reports for this clinic",
          );
        }

        let query = db
          .selectFrom("inventory_transactions as it")
          .innerJoin("drug_catalogue as dc", "it.drug_id", "dc.id")
          .leftJoin("drug_batches as db", "it.batch_id", "db.id")
          .leftJoin("users as u", "it.performed_by", "u.id")
          .select([
            "it.id",
            "it.clinic_id",
            "it.drug_id",
            "it.batch_id",
            "it.transaction_type",
            "it.quantity",
            "it.balance_after",
            "it.reference_type",
            "it.reference_id",
            "it.reason",
            "it.performed_by",
            "it.timestamp",
            "it.created_at",
            "dc.generic_name",
            "dc.brand_name",
            "dc.form",
            "dc.dosage_quantity",
            "dc.dosage_units",
            "db.batch_number",
            "db.expiry_date",
            "u.name as performed_by_name",
          ])
          .where("it.clinic_id", "=", clinicId);

        if (options.startDate) {
          query = query.where(
            "it.timestamp",
            ">=",
            sql`${toSafeDateString(options.startDate)}::timestamp with time zone`,
          );
        }

        if (options.endDate) {
          query = query.where(
            "it.timestamp",
            "<=",
            sql`${toSafeDateString(options.endDate)}::timestamp with time zone`,
          );
        }

        if (options.transactionType) {
          query = query.where(
            "it.transaction_type",
            "=",
            options.transactionType,
          );
        }

        const results = await query
          .orderBy("it.timestamp", "desc")
          .limit(options.limit || 50)
          .offset(options.offset || 0)
          .execute();

        return results;
      },
    );

    /**
     * Get summary statistics for a clinic
     */
    export const getSummaryStats = serverOnly(
      async (
        clinicId: string,
        {
          startDate,
          endDate,
        }: {
          startDate?: Date;
          endDate?: Date;
        } = {},
      ): Promise<any> => {
        // Permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "can_view_reports",
          );

        if (!clinicIds.includes(clinicId)) {
          throw new Error(
            "Unauthorized: No permission to view reports for this clinic",
          );
        }

        let query = db
          .selectFrom(Table.name)
          .select([
            "transaction_type",
            (eb) => eb.fn.count<number>("id").as("count"),
            (eb) => eb.fn.sum<number>("quantity").as("total_quantity"),
          ])
          .where("clinic_id", "=", clinicId)
          .groupBy("transaction_type");

        if (startDate) {
          query = query.where(
            "timestamp",
            ">=",
            sql`${toSafeDateString(startDate)}::timestamp with time zone`,
          );
        }

        if (endDate) {
          query = query.where(
            "timestamp",
            "<=",
            sql`${toSafeDateString(endDate)}::timestamp with time zone`,
          );
        }

        const results = await query.execute();

        return {
          summary: results,
          period: {
            start: startDate || null,
            end: endDate || null,
          },
        };
      },
    );
  }

  /**
   * No Sync namespace as this is a server-only audit table
   */
}

export default InventoryTransactions;
