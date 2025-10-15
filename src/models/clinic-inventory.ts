import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
import { Option } from "effect";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  type JSONColumnType,
  sql,
} from "kysely";
import { safeJSONParse, toSafeDateString } from "@/lib/utils";
import UserClinicPermissions from "./user-clinic-permissions";
import { v1 as uuidV1 } from "uuid";

namespace ClinicInventory {
  export type T = {
    id: string;
    clinic_id: string;
    drug_id: string;
    batch_id: string;
    quantity_available: number;
    reserved_quantity: number;
    last_counted_at: Option.Option<Date>;
    recorded_by_user_id: Option.Option<string>;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Option.Option<Date>;
  };

  export type EncodedT = {
    id: string;
    clinic_id: string;
    drug_id: string;
    batch_id: string;
    quantity_available: number;
    reserved_quantity: number;
    last_counted_at: Date | null;
    recorded_by_user_id: string | null;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Date | null;
  };

  /**
   * Type definition for drug inventory item with batch information
   */
  export type DrugWithBatchInfo = {
    drug_id: string;
    generic_name: string;
    brand_name: string | null;
    form: string | null;
    route: string | null;
    dosage_quantity: number | null;
    dosage_units: string | null;
    sale_price: number | null;
    sale_currency: string | null;
    is_controlled: boolean;
    requires_refrigeration: boolean;
    batch_expiry_date: Date | null;
    quantity: number;
    reserved_quantity: number;
    batches: {
      batch_id: string;
      batch_expiry_date: Date | null;
      quantity: number;
    }[];
  };

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * This table is server-only and synced down to clients for read-only access.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = true;
    export const name = "clinic_inventory";
    /** The name of the table in the mobile database */
    export const mobileName = "clinic_inventory";
    export const columns = {
      id: "id",
      clinic_id: "clinic_id",
      drug_id: "drug_id",
      batch_id: "batch_id",
      quantity_available: "quantity_available",
      reserved_quantity: "reserved_quantity",
      last_counted_at: "last_counted_at",
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
      clinic_id: string;
      drug_id: string;
      batch_id: string;
      quantity_available: number;
      reserved_quantity: Generated<number>;
      last_counted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      recorded_by_user_id: string | null;
      metadata: JSONColumnType<Record<string, any>>;
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

    export type ClinicInventory = Selectable<T>;
    export type NewClinicInventory = Insertable<T>;
    export type ClinicInventoryUpdate = Updateable<T>;
  }

  export namespace API {
    export const getById = serverOnly(
      async (id: string): Promise<EncodedT | undefined> => {
        return (await db
          .selectFrom(Table.name)
          .selectAll()
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .executeTakeFirst()) as Promise<EncodedT | undefined>;
      },
    );

    export const getByClinicAndDrug = serverOnly(
      async (
        clinicId: string,
        drugId: string,
        batchId?: string,
      ): Promise<EncodedT | undefined> => {
        let query = db
          .selectFrom(Table.name)
          .selectAll()
          .where("clinic_id", "=", clinicId)
          .where("drug_id", "=", drugId)
          .where("is_deleted", "=", false);

        if (batchId) {
          query = query.where("batch_id", "=", batchId);
        }

        return (await query.executeTakeFirst()) as Promise<
          EncodedT | undefined
        >;
      },
    );

    export const getByClinic = serverOnly(
      async (
        clinicId: string,
        {
          limit = 50,
          offset = 0,
          includeZeroStock = false,
        }: {
          limit?: number;
          offset?: number;
          includeZeroStock?: boolean;
        } = {},
      ): Promise<EncodedT[]> => {
        let query = db
          .selectFrom(Table.name)
          .selectAll()
          .where("clinic_id", "=", clinicId)
          .where("is_deleted", "=", false);

        if (!includeZeroStock) {
          query = query.where("quantity_available", ">", 0);
        }

        const results = await query
          .orderBy("drug_id", "asc")
          .limit(limit)
          .offset(offset)
          .execute();

        return results as EncodedT[];
      },
    );

    /**
     * Get inventory items with drug information
     * @param clinicId - The ID of the clinic to retrieve inventory for
     * @param searchQuery - Optional search query to filter drugs by generic_name or brand_name
     * @param options - Query options
     * @param options.limit - Maximum number of items to return (default: 50)
     * @param options.offset - Number of items to skip for pagination (default: 0)
     * @param options.includeZeroStock - Whether to include items with zero quantity (default: false)
     * @returns Array of inventory items grouped by drug with batch information
     */
    export const getWithDrugInfo = serverOnly(
      async (
        clinicId: string,
        searchQuery?: string,
        {
          limit = 50,
          offset = 0,
          includeZeroStock = true,
        }: {
          limit?: number;
          offset?: number;
          includeZeroStock?: boolean;
        } = {},
      ): Promise<DrugWithBatchInfo[]> => {
        // Single query to get drugs with their batches using JSON aggregation
        let query = db
          .selectFrom("drug_catalogue as dc")
          .select([
            "dc.id as drug_id",
            "dc.generic_name",
            "dc.brand_name",
            "dc.form",
            "dc.route",
            "dc.dosage_quantity",
            "dc.dosage_units",
            sql<number | null>`dc.sale_price`.as("sale_price"),
            "dc.sale_currency",
            "dc.is_controlled",
            "dc.requires_refrigeration",
            // Get the first batch info (for compatibility with existing code that expects batch_id and batch_expiry_date)
            // sql<string>`(
            //   SELECT ci.batch_id
            //   FROM clinic_inventory ci
            //   WHERE ci.clinic_id = ${clinicId}
            //     AND ci.drug_id = dc.id
            //     AND ci.is_deleted = false
            //     ${!includeZeroStock ? sql`AND ci.quantity_available > 0` : sql``}
            //   ORDER BY ci.quantity_available DESC
            //   LIMIT 1
            // )`.as("batch_id"),
            sql<Date | null>`(
              SELECT db.expiry_date
              FROM clinic_inventory ci
              LEFT JOIN drug_batches db ON ci.batch_id = db.id
              WHERE ci.clinic_id = ${clinicId}
                AND ci.drug_id = dc.id
                AND ci.is_deleted = false
                ${!includeZeroStock ? sql`AND ci.quantity_available > 0` : sql``}
              ORDER BY ci.quantity_available DESC
              LIMIT 1
            )`.as("batch_expiry_date"),
            // Calculate total quantity
            sql<number>`(
              SELECT COALESCE(SUM(ci.quantity_available), 0)
              FROM clinic_inventory ci
              WHERE ci.clinic_id = ${clinicId}
                AND ci.drug_id = dc.id
                AND ci.is_deleted = false
                ${!includeZeroStock ? sql`AND ci.quantity_available > 0` : sql``}
            )`.as("quantity"),
            // Calculate total quantity reserved
            sql<number>`(
              SELECT COALESCE(SUM(ci.reserved_quantity), 0)
              FROM clinic_inventory ci
              WHERE ci.clinic_id = ${clinicId}
                AND ci.drug_id = dc.id
                AND ci.is_deleted = false
                AND ci.reserved_quantity > 0
            )`.as("reserved_quantity"),
            // Get all batches as JSON array
            sql<
              {
                batch_id: string;
                batch_expiry_date: Date | null;
                quantity: number;
              }[]
            >`(
              SELECT COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'batch_id', ci.batch_id,
                    'batch_expiry_date', db.expiry_date,
                    'quantity', ci.quantity_available
                  )
                  ORDER BY db.expiry_date ASC NULLS LAST, ci.quantity_available DESC
                ),
                '[]'::json
              )
              FROM clinic_inventory ci
              LEFT JOIN drug_batches db ON ci.batch_id = db.id
              WHERE ci.clinic_id = ${clinicId}
                AND ci.drug_id = dc.id
                AND ci.is_deleted = false
                ${!includeZeroStock ? sql`AND ci.quantity_available > 0` : sql``}
            )`.as("batches"),
          ])
          .where("dc.is_deleted", "=", false)
          .where("dc.is_active", "=", true)
          // Only include drugs that have inventory records
          .where((eb) =>
            eb.exists(
              eb
                .selectFrom("clinic_inventory as ci")
                .select("ci.id")
                .whereRef("ci.drug_id", "=", "dc.id")
                .where("ci.clinic_id", "=", clinicId)
                .where("ci.is_deleted", "=", false)
                .$if(!includeZeroStock, (qb) =>
                  qb.where("ci.quantity_available", ">", 0),
                ),
            ),
          );

        // Add search filter if searchQuery is provided
        if (searchQuery && searchQuery.trim()) {
          const searchPattern = `%${searchQuery.trim()}%`;
          query = query.where((eb) =>
            eb.or([
              eb("dc.generic_name", "ilike", searchPattern),
              eb("dc.brand_name", "ilike", searchPattern),
            ]),
          );
        }

        query = query
          .orderBy("dc.generic_name", "asc")
          .limit(limit)
          .offset(offset);

        const results = await query.execute();

        return results as DrugWithBatchInfo[];
      },
    );

    /**
     * Update inventory quantity - this is a server-only operation
     * Use this for receiving stock, dispensing, adjustments, etc.
     */
    export const updateQuantity = serverOnly(
      async ({
        clinicId,
        drugId,
        batchId,
        quantityChange,
        transactionType,
        referenceId,
        reason,
        performedBy,
        reserveQuantity,
      }: {
        clinicId: string;
        drugId: string;
        batchId: string;
        quantityChange: number; // Positive for additions, negative for reductions
        transactionType: string; // received, dispensed, transferred_in, transferred_out, expired, damaged, adjustment, returned
        referenceId?: string;
        reason?: string;
        performedBy?: string;
        reserveQuantity?: number; // Optional: update reserved quantity
      }): Promise<any> => {
        // Permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "is_clinic_admin",
          );

        if (!clinicIds.includes(clinicId)) {
          throw new Error(
            "Unauthorized: No inventory management permissions for this clinic",
          );
        }

        return await db.transaction().execute(async (trx) => {
          // Get current inventory or create if doesn't exist
          const currentInventory = await trx
            .selectFrom(Table.name)
            .selectAll()
            .where("clinic_id", "=", clinicId)
            .where("drug_id", "=", drugId)
            .where("batch_id", "=", batchId)
            .where("is_deleted", "=", false)
            .executeTakeFirst();

          let newQuantity: number;
          let inventoryId: string;

          if (currentInventory) {
            newQuantity = currentInventory.quantity_available + quantityChange;
            inventoryId = currentInventory.id;

            // Update existing inventory
            await trx
              .updateTable(Table.name)
              .set({
                quantity_available: newQuantity,
                reserved_quantity:
                  reserveQuantity ?? currentInventory.reserved_quantity,
                updated_at: sql`now()::timestamp with time zone`,
                last_modified: sql`now()::timestamp with time zone`,
                last_counted_at:
                  transactionType === "adjustment"
                    ? sql`now()::timestamp with time zone`
                    : currentInventory.last_counted_at,
              })
              .where("id", "=", inventoryId)
              .execute();
          } else {
            // Create new inventory entry
            newQuantity = quantityChange;
            inventoryId = uuidV1();

            await trx
              .insertInto(Table.name)
              .values({
                id: inventoryId,
                clinic_id: clinicId,
                drug_id: drugId,
                batch_id: batchId,
                quantity_available: newQuantity,
                reserved_quantity: reserveQuantity ?? 0,
                last_counted_at:
                  transactionType === "adjustment"
                    ? sql`now()::timestamp with time zone`
                    : null,
                recorded_by_user_id: performedBy || null,
                metadata: sql`'{}'::jsonb`,
                is_deleted: false,
                created_at: sql`now()::timestamp with time zone`,
                updated_at: sql`now()::timestamp with time zone`,
                last_modified: sql`now()::timestamp with time zone`,
                server_created_at: sql`now()::timestamp with time zone`,
                deleted_at: null,
              })
              .execute();
          }

          // Record the transaction
          // TODO: move this to the inventory_transactions model
          await trx
            .insertInto("inventory_transactions")
            .values({
              id: uuidV1(),
              clinic_id: clinicId,
              drug_id: drugId,
              batch_id: batchId,
              transaction_type: transactionType,
              quantity: quantityChange,
              balance_after: newQuantity,
              reference_type:
                transactionType === "dispensed"
                  ? "dispensing_record"
                  : transactionType === "adjustment"
                    ? "adjustment_record"
                    : null,
              reference_id: referenceId || null,
              reason: reason || null,
              performed_by: performedBy || null,
              timestamp: sql`now()::timestamp with time zone`,
              created_at: sql`now()::timestamp with time zone`,
              updated_at: sql`now()::timestamp with time zone`,
            })
            .execute();

          return { inventoryId, newQuantity };
        });
      },
    );

    /**
     * Reserve quantity for pending prescriptions
     */
    export const reserveQuantity = serverOnly(
      async ({
        clinicId,
        drugId,
        batchId,
        quantityToReserve,
      }: {
        clinicId: string;
        drugId: string;
        batchId: string;
        quantityToReserve: number;
      }): Promise<void> => {
        const inventory = await getByClinicAndDrug(clinicId, drugId, batchId);

        if (!inventory) {
          throw new Error("Inventory item not found");
        }

        if (inventory.quantity_available < quantityToReserve) {
          throw new Error("Insufficient stock to reserve");
        }

        await db
          .updateTable(Table.name)
          .set({
            reserved_quantity: inventory.reserved_quantity + quantityToReserve,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", inventory.id)
          .execute();
      },
    );

    /**
     * Release reserved quantity (e.g., when prescription is cancelled)
     */
    export const releaseReservedQuantity = serverOnly(
      async ({
        clinicId,
        drugId,
        batchId,
        quantityToRelease,
      }: {
        clinicId: string;
        drugId: string;
        batchId: string;
        quantityToRelease: number;
      }): Promise<void> => {
        const inventory = await getByClinicAndDrug(clinicId, drugId, batchId);

        if (!inventory) {
          throw new Error("Inventory item not found");
        }

        const newReservedQuantity = Math.max(
          0,
          inventory.reserved_quantity - quantityToRelease,
        );

        await db
          .updateTable(Table.name)
          .set({
            reserved_quantity: newReservedQuantity,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", inventory.id)
          .execute();
      },
    );

    /**
     * Perform stock count/adjustment
     */
    export const performStockCount = serverOnly(
      async ({
        clinicId,
        drugId,
        batchId,
        actualQuantity,
        performedBy,
        reason,
      }: {
        clinicId: string;
        drugId: string;
        batchId: string;
        actualQuantity: number;
        performedBy: string;
        reason?: string;
      }): Promise<void> => {
        const inventory = await getByClinicAndDrug(clinicId, drugId, batchId);

        if (!inventory) {
          // Create new inventory entry if doesn't exist
          await updateQuantity({
            clinicId,
            drugId,
            batchId,
            quantityChange: actualQuantity,
            transactionType: "adjustment",
            reason: reason || "Initial stock count",
            performedBy,
          });
        } else {
          const quantityDifference =
            actualQuantity - inventory.quantity_available;

          if (quantityDifference !== 0) {
            await updateQuantity({
              clinicId,
              drugId,
              batchId,
              quantityChange: quantityDifference,
              transactionType: "adjustment",
              reason:
                reason ||
                `Stock count adjustment: ${quantityDifference > 0 ? "+" : ""}${quantityDifference}`,
              performedBy,
            });
          } else {
            // Just update the last_counted_at timestamp
            await db
              .updateTable(Table.name)
              .set({
                last_counted_at: sql`now()::timestamp with time zone`,
                updated_at: sql`now()::timestamp with time zone`,
                last_modified: sql`now()::timestamp with time zone`,
              })
              .where("id", "=", inventory.id)
              .execute();
          }
        }
      },
    );

    export const softDelete = serverOnly(async (id: string) => {
      // Permissions check
      const clinicIds =
        await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
          "can_manage_inventory",
        );

      const inventory = await getById(id);
      if (!inventory) {
        throw new Error("Inventory item not found");
      }

      if (!clinicIds.includes(inventory.clinic_id)) {
        throw new Error(
          "Unauthorized: No inventory management permissions for this clinic",
        );
      }

      await db
        .updateTable(Table.name)
        .set({
          is_deleted: true,
          deleted_at: sql`now()::timestamp with time zone`,
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
        })
        .where("id", "=", id)
        .execute();
    });
  }

  export namespace Sync {
    /**
     * This namespace is limited since clinic_inventory is server-only
     * and should never be modified from the client
     */

    /**
     * Get inventory for sync to mobile (read-only)
     */
    export const getForMobileSync = serverOnly(
      async (clinicId: string): Promise<EncodedT[]> => {
        const results = await db
          .selectFrom(Table.name)
          .selectAll()
          .where("clinic_id", "=", clinicId)
          .where("is_deleted", "=", false)
          .execute();

        return results as EncodedT[];
      },
    );
  }
}

export default ClinicInventory;
