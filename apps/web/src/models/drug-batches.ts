import db from "@/db";
import { createServerOnlyFn } from "@tanstack/react-start";
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
import InventoryTransactions from "./inventory-transactions";

namespace DrugBatches {
  export type T = {
    id: string;
    drug_id: string;
    batch_number: string;
    expiry_date: Date;
    manufacture_date: Option.Option<Date>;
    quantity_received: number;
    quantity_remaining: number;
    supplier_name: Option.Option<string>;
    purchase_price: Option.Option<number>;
    purchase_currency: Option.Option<string>;
    received_date: Date;
    is_quarantined: boolean;
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
    drug_id: string;
    batch_number: string;
    expiry_date: Date;
    manufacture_date: Date | null;
    quantity_received: number;
    quantity_remaining: number;
    supplier_name: string | null;
    purchase_price: number | null;
    purchase_currency: string | null;
    received_date: Date;
    is_quarantined: boolean;
    recorded_by_user_id: string | null;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Date | null;
  };

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = true;
    export const name = "drug_batches";
    /** The name of the table in the mobile database */
    export const mobileName = "drug_batches";
    export const columns = {
      id: "id",
      drug_id: "drug_id",
      batch_number: "batch_number",
      expiry_date: "expiry_date",
      manufacture_date: "manufacture_date",
      quantity_received: "quantity_received",
      quantity_remaining: "quantity_remaining",
      supplier_name: "supplier_name",
      purchase_price: "purchase_price",
      purchase_currency: "purchase_currency",
      received_date: "received_date",
      is_quarantined: "is_quarantined",
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
      drug_id: string;
      batch_number: string;
      expiry_date: ColumnType<Date, string | Date, string | Date>;
      manufacture_date: ColumnType<
        Date | null,
        string | Date | null | undefined,
        string | Date | null
      >;
      quantity_received: number;
      quantity_remaining: number;
      supplier_name: string | null;
      purchase_price: ColumnType<
        number | null,
        string | number | null,
        string | number | null
      >;
      purchase_currency: Generated<string | null>;
      received_date: ColumnType<Date, string | Date, string | Date>;
      is_quarantined: Generated<boolean>;
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

    export type DrugBatches = Selectable<T>;
    export type NewDrugBatches = Insertable<T>;
    export type DrugBatchesUpdate = Updateable<T>;
  }

  export namespace API {
    export const getById = createServerOnlyFn(
      async (id: string): Promise<EncodedT | undefined> => {
        return (await db
          .selectFrom(Table.name)
          .selectAll()
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .executeTakeFirst()) as Promise<EncodedT | undefined>;
      },
    );

    export const getByDrugId = createServerOnlyFn(
      async (
        drugId: string,
        {
          limit = 50,
          offset = 0,
          includeQuarantined = false,
          onlyAvailable = false,
        }: {
          limit?: number;
          offset?: number;
          includeQuarantined?: boolean;
          onlyAvailable?: boolean;
        } = {},
      ): Promise<EncodedT[]> => {
        let query = db
          .selectFrom(Table.name)
          .selectAll()
          .where("drug_id", "=", drugId)
          .where("is_deleted", "=", false);

        if (!includeQuarantined) {
          query = query.where("is_quarantined", "=", false);
        }

        if (onlyAvailable) {
          query = query.where("quantity_remaining", ">", 0);
        }

        // TODO: ignore any expired batches

        const results = await query
          .orderBy("expiry_date", "asc")
          .limit(limit)
          .offset(offset)
          .execute();

        return results as EncodedT[];
      },
    );

    export const getByBatchNumber = createServerOnlyFn(
      async (
        batchNumber: string,
        drugId?: string,
      ): Promise<EncodedT | undefined> => {
        let query = db
          .selectFrom(Table.name)
          .selectAll()
          .where("batch_number", "=", batchNumber)
          .where("is_deleted", "=", false);

        if (drugId) {
          query = query.where("drug_id", "=", drugId);
        }

        return (await query.executeTakeFirst()) as Promise<
          EncodedT | undefined
        >;
      },
    );

    export const getExpiringBatches = createServerOnlyFn(
      async (daysAhead: number = 30, clinicId?: string): Promise<any[]> => {
        let query = db
          .selectFrom("drug_batches as db")
          .innerJoin("drug_catalogue as dc", "db.drug_id", "dc.id")
          .select([
            "db.id as batch_id",
            "db.batch_number",
            "db.expiry_date",
            "db.quantity_remaining",
            "db.supplier_name",
            "dc.id as drug_id",
            "dc.generic_name",
            "dc.brand_name",
            "dc.form",
            "dc.dosage_quantity",
            "dc.dosage_units",
          ])
          .where("db.is_deleted", "=", false)
          .where("dc.is_deleted", "=", false)
          .where("db.quantity_remaining", ">", 0)
          .where("db.is_quarantined", "=", false)
          .where(
            "db.expiry_date",
            "<=",
            sql`CURRENT_DATE + INTERVAL '${daysAhead} days'`,
          )
          .where("db.expiry_date", ">=", sql`CURRENT_DATE`);

        // If clinicId is provided, filter by batches available in that clinic
        if (clinicId) {
          query = query
            .innerJoin("clinic_inventory as ci", (join) =>
              join
                .on("ci.drug_id", "=", "db.drug_id")
                .on("ci.batch_id", "=", "db.id"),
            )
            .where("ci.clinic_id", "=", clinicId)
            .where("ci.is_deleted", "=", false)
            .where("ci.quantity_available", ">", 0);
        }

        const results = await query.orderBy("db.expiry_date", "asc").execute();

        return results;
      },
    );

    export const getExpiredBatches = createServerOnlyFn(
      async (): Promise<any[]> => {
        const results = await db
          .selectFrom("drug_batches as db")
          .innerJoin("drug_catalogue as dc", "db.drug_id", "dc.id")
          .select([
            "db.id as batch_id",
            "db.batch_number",
            "db.expiry_date",
            "db.quantity_remaining",
            "db.supplier_name",
            "dc.id as drug_id",
            "dc.generic_name",
            "dc.brand_name",
            "dc.form",
            "dc.dosage_quantity",
            "dc.dosage_units",
          ])
          .where("db.is_deleted", "=", false)
          .where("dc.is_deleted", "=", false)
          .where("db.quantity_remaining", ">", 0)
          .where("db.expiry_date", "<", sql`CURRENT_DATE`)
          .orderBy("db.expiry_date", "desc")
          .execute();

        return results;
      },
    );

    export const upsert = createServerOnlyFn(
      async (batch: Partial<EncodedT>) => {
        // Permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "is_clinic_admin",
          );

        if (clinicIds.length === 0) {
          throw new Error("Unauthorized: No inventory management permissions");
        }

        return await upsert_core(batch);
      },
    );

    export const DANGEROUS_SYNC_ONLY_upsert = createServerOnlyFn(
      async (batch: Partial<EncodedT>) => {
        return await upsert_core(batch);
      },
    );

    const upsert_core = createServerOnlyFn(async (batch: Partial<EncodedT>) => {
      const id = batch.id || uuidV1();

      // Validate required fields
      if (!batch.drug_id || !batch.batch_number || !batch.expiry_date) {
        throw new Error("Drug ID, batch number, and expiry date are required");
      }

      if (!batch.received_date) {
        throw new Error("Received date is required");
      }

      if (
        batch.quantity_received === undefined ||
        batch.quantity_received < 0
      ) {
        throw new Error("Valid quantity received is required");
      }

      const result = await db
        .insertInto(Table.name)
        .values({
          id,
          drug_id: batch.drug_id,
          batch_number: batch.batch_number,
          expiry_date: sql`${toSafeDateString(batch.expiry_date)}::date`,
          manufacture_date: batch.manufacture_date
            ? sql`${toSafeDateString(batch.manufacture_date)}::date`
            : null,
          quantity_received: batch.quantity_received,
          quantity_remaining:
            batch.quantity_remaining ?? batch.quantity_received,
          supplier_name: batch.supplier_name || null,
          purchase_price: batch.purchase_price || null,
          purchase_currency: batch.purchase_currency || "",
          received_date: sql`${toSafeDateString(batch.received_date)}::date`,
          is_quarantined: batch.is_quarantined ?? false,
          recorded_by_user_id: batch.recorded_by_user_id || null,
          metadata: sql`${JSON.stringify(
            safeJSONParse(batch.metadata, {}),
          )}::jsonb`,
          is_deleted: batch.is_deleted ?? false,
          created_at: batch.created_at
            ? sql`${toSafeDateString(batch.created_at)}::timestamp with time zone`
            : sql`now()::timestamp with time zone`,
          updated_at: batch.updated_at
            ? sql`${toSafeDateString(batch.updated_at)}::timestamp with time zone`
            : sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
          server_created_at: sql`now()::timestamp with time zone`,
          deleted_at: batch.deleted_at
            ? sql`${toSafeDateString(batch.deleted_at)}::timestamp with time zone`
            : null,
        })
        .onConflict((oc) =>
          oc.columns(["batch_number", "drug_id"]).doUpdateSet({
            expiry_date: (eb) => eb.ref("excluded.expiry_date"),
            manufacture_date: (eb) => eb.ref("excluded.manufacture_date"),
            // on update, we increment the quantity_received by the new quantity_received
            quantity_received: (eb) =>
              eb(
                "drug_batches.quantity_received",
                "+",
                batch.quantity_received,
              ),
            quantity_remaining: (eb) =>
              eb(
                "drug_batches.quantity_remaining",
                "+",
                batch.quantity_received,
              ),
            supplier_name: (eb) => eb.ref("excluded.supplier_name"),
            purchase_price: (eb) => eb.ref("excluded.purchase_price"),
            purchase_currency: (eb) => eb.ref("excluded.purchase_currency"),
            received_date: (eb) => eb.ref("excluded.received_date"),
            is_quarantined: (eb) => eb.ref("excluded.is_quarantined"),
            recorded_by_user_id: (eb) => eb.ref("excluded.recorded_by_user_id"),
            metadata: (eb) => eb.ref("excluded.metadata"),
            is_deleted: (eb) => eb.ref("excluded.is_deleted"),
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          }),
        )
        .returning("id")
        .executeTakeFirstOrThrow();

      return result;
    });

    export const updateQuantity = createServerOnlyFn(
      async (
        id: string,
        quantityChange: number,
        transactionType: string,
        reason?: string,
      ): Promise<void> => {
        // Permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "is_clinic_admin",
          );

        if (clinicIds.length === 0) {
          throw new Error("Unauthorized: No inventory management permissions");
        }

        const batch = await getById(id);
        if (!batch) {
          throw new Error("Batch not found");
        }

        const newQuantity = batch.quantity_remaining + quantityChange;
        if (newQuantity < 0) {
          throw new Error("Insufficient quantity in batch");
        }

        await db
          .updateTable(Table.name)
          .set({
            quantity_remaining: newQuantity,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", id)
          .execute();
      },
    );

    export const quarantineBatch = createServerOnlyFn(
      async (
        id: string,
        reason: string,
        performedBy?: string,
      ): Promise<void> => {
        // Permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "is_clinic_admin",
          );

        if (clinicIds.length === 0) {
          throw new Error("Unauthorized: No inventory management permissions");
        }

        await db
          .updateTable(Table.name)
          .set({
            is_quarantined: true,
            metadata: sql`jsonb_set(
              COALESCE(metadata, '{}'),
              '{quarantine_info}',
              ${JSON.stringify({
                reason,
                quarantined_by: performedBy,
                quarantined_at: new Date().toISOString(),
              })}::jsonb
            )`,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", id)
          .execute();
      },
    );

    export const releaseBatch = createServerOnlyFn(
      async (
        id: string,
        reason: string,
        performedBy?: string,
      ): Promise<void> => {
        // Permissions check
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "is_clinic_admin",
          );

        if (clinicIds.length === 0) {
          throw new Error("Unauthorized: No inventory management permissions");
        }

        await db
          .updateTable(Table.name)
          .set({
            is_quarantined: false,
            metadata: sql`jsonb_set(
              COALESCE(metadata, '{}'),
              '{release_info}',
              ${JSON.stringify({
                reason,
                released_by: performedBy,
                released_at: new Date().toISOString(),
              })}::jsonb
            )`,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", id)
          .execute();
      },
    );

    export const softDelete = createServerOnlyFn(async (id: string) => {
      // Permissions check
      const clinicIds =
        await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
          "is_clinic_admin",
        );

      if (clinicIds.length === 0) {
        throw new Error("Unauthorized: No inventory management permissions");
      }

      return await softDelete_core(id);
    });

    export const DANGEROUS_SYNC_ONLY_softDelete = createServerOnlyFn(
      async (id: string) => {
        return await softDelete_core(id);
      },
    );

    const softDelete_core = createServerOnlyFn(async (id: string) => {
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

    export const getBatchesBySupplier = createServerOnlyFn(
      async (
        supplierName: string,
        {
          limit = 50,
          offset = 0,
        }: {
          limit?: number;
          offset?: number;
        } = {},
      ): Promise<any[]> => {
        const results = await db
          .selectFrom("drug_batches as db")
          .innerJoin("drug_catalogue as dc", "db.drug_id", "dc.id")
          .select([
            "db.id",
            "db.batch_number",
            "db.expiry_date",
            "db.quantity_received",
            "db.quantity_remaining",
            "db.purchase_price",
            "db.purchase_currency",
            "db.received_date",
            "dc.generic_name",
            "dc.brand_name",
            "dc.form",
            "dc.dosage_quantity",
            "dc.dosage_units",
          ])
          .where("db.supplier_name", "ilike", `%${supplierName}%`)
          .where("db.is_deleted", "=", false)
          .orderBy("db.received_date", "desc")
          .limit(limit)
          .offset(offset)
          .execute();

        return results;
      },
    );

    export const getTotalValue = createServerOnlyFn(
      async (drugId?: string): Promise<any> => {
        let query = db
          .selectFrom(Table.name)
          .select([
            (eb) =>
              eb.fn
                .sum<number>(
                  sql`quantity_remaining * COALESCE(purchase_price, 0)`,
                )
                .as("total_value"),
            (eb) =>
              eb.fn.sum<number>("quantity_remaining").as("total_quantity"),
            (eb) => eb.fn.count<number>("id").as("batch_count"),
          ])
          .where("is_deleted", "=", false)
          .where("is_quarantined", "=", false);

        if (drugId) {
          query = query.where("drug_id", "=", drugId);
        }

        const result = await query.executeTakeFirst();
        return result;
      },
    );
  }

  export namespace Sync {
    export const upsertFromDelta = createServerOnlyFn(
      async (delta: EncodedT) => {
        return API.DANGEROUS_SYNC_ONLY_upsert(delta);
      },
    );

    export const deleteFromDelta = createServerOnlyFn(async (id: string) => {
      return API.DANGEROUS_SYNC_ONLY_softDelete(id);
    });
  }
}

export default DrugBatches;
