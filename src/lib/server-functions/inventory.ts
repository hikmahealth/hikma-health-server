import * as Sentry from "@sentry/tanstackstart-react";

import ClinicInventory from "@/models/clinic-inventory";
import DrugBatches from "@/models/drug-batches";
import { createServerFn } from "@tanstack/react-start";
import { v1 as uuidV1 } from "uuid";

export const getClinicInventory = createServerFn({ method: "GET" })
  .validator(
    (params: {
      clinicId: string;
      searchQuery?: string;
      limit?: number;
      offset?: number;
    }) => params,
  )
  .handler(async ({ data }) => {
    return Sentry.startSpan(
      { name: "Get clinic inventory with drug info" },
      async () => {
        try {
          const items = await ClinicInventory.API.getWithDrugInfo(
            data.clinicId,
            data.searchQuery ?? "",
            {
              limit: data.limit ?? 100,
              offset: data.offset ?? 0,
              includeZeroStock: true,
            },
          );

          // We don't know the exact total, so we estimate based on whether we got a full page
          // This avoids an extra query and is more efficient
          const hasMore = items.length === (data.limit ?? 100);

          return { items, hasMore };
        } catch (error) {
          Sentry.captureException(error);
          return { items: [], hasMore: false };
        }
      },
    );
  });

export const getClinicInventoryById = createServerFn({ method: "GET" })
  .validator((params: { id: string }) => params)
  .handler(async ({ data }) => {
    return Sentry.startSpan(
      { name: "Get clinic inventory item by ID" },
      async () => {
        try {
          const item = await ClinicInventory.API.getById(data.id);
          return item || null;
        } catch (error) {
          Sentry.captureException(error);
          return null;
        }
      },
    );
  });

export const getBatchesByDrug = createServerFn({ method: "GET" })
  .validator(
    (params: {
      drugId: string;
      onlyAvailable?: boolean;
      includeQuarantined?: boolean;
    }) => params,
  )
  .handler(async ({ data }) => {
    return Sentry.startSpan({ name: "Get batches for drug" }, async () => {
      try {
        const batches = await DrugBatches.API.getByDrugId(data.drugId, {
          onlyAvailable: data.onlyAvailable ?? true,
          includeQuarantined: data.includeQuarantined ?? false,
          limit: 100,
        });

        return batches || [];
      } catch (error) {
        Sentry.captureException(error);
        return [];
      }
    });
  });

export const saveClinicInventory = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string | null;
      clinicId: string;
      drugId: string;
      batchNumber: string;
      batchExpiryDate: Date;
      batchId: string;
      quantityAvailable: number;
      metadata?: Record<string, any>;
      recordedByUserId: string;
      isNew: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    return Sentry.startSpan(
      { name: "Save clinic inventory item" },
      async () => {
        try {
          if (data.isNew) {
            // For new items, use the updateQuantity API which handles creation
            const result = await ClinicInventory.API.updateQuantity({
              clinicId: data.clinicId,
              drugId: data.drugId,
              batchId: data.batchId,
              batchNumber: data.batchNumber,
              batchExpiryDate: data.batchExpiryDate,
              quantityChange: data.quantityAvailable,
              transactionType: "receiving",
              reason: "Initial stock",
              performedBy: data.recordedByUserId,
            });
            return { success: true, data: result };
          } else {
            // For existing items, we need to calculate the quantity change
            const existing = await ClinicInventory.API.getById(data.id!);
            if (!existing) {
              throw new Error("Inventory item not found");
            }

            const quantityChange =
              data.quantityAvailable - existing.quantity_available;
            const transactionType =
              quantityChange > 0 ? "receiving" : "adjustment";

            const result = await ClinicInventory.API.updateQuantity({
              clinicId: data.clinicId,
              drugId: data.drugId,
              batchId: data.batchId,
              batchNumber: data.batchNumber,
              batchExpiryDate: data.batchExpiryDate,
              quantityChange: quantityChange,
              transactionType: transactionType,
              reason: "Stock update",
              performedBy: data.recordedByUserId,
            });
            return { success: true, data: result };
          }
        } catch (error) {
          Sentry.captureException(error);
          return { success: false, error: String(error) };
        }
      },
    );
  });

export const createDrugBatch = createServerFn({ method: "POST" })
  .validator(
    (data: {
      drugId: string;
      clinicId: string;
      batchNumber: string;
      expiryDate: string;
      manufactureDate?: string;
      quantityReceived: number;
      supplierName?: string;
      purchasePrice?: number;
      purchaseCurrency?: string;
      recordedByUserId: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    return Sentry.startSpan({ name: "Create drug batch" }, async () => {
      // TODO: this should be a transaction
      try {
        const batchData: Partial<DrugBatches.EncodedT> = {
          id: uuidV1(),
          drug_id: data.drugId,
          batch_number: data.batchNumber,
          expiry_date: new Date(data.expiryDate),
          manufacture_date: data.manufactureDate
            ? new Date(data.manufactureDate)
            : null,
          quantity_received: data.quantityReceived,
          quantity_remaining: data.quantityReceived,
          supplier_name: data.supplierName || null,
          purchase_price: data.purchasePrice || null,
          purchase_currency: data.purchaseCurrency || "USD",
          received_date: new Date(),
          is_quarantined: false,
          recorded_by_user_id: data.recordedByUserId,
          metadata: {},
          is_deleted: false,
        };

        const batchResult = await DrugBatches.API.upsert(batchData);

        // Automatically create inventory entry for this batch in the specified clinic
        if (batchResult && data.clinicId) {
          await ClinicInventory.API.updateQuantity({
            clinicId: data.clinicId,
            drugId: data.drugId,
            batchId: batchResult.id,
            batchNumber: data.batchNumber,
            batchExpiryDate: new Date(data.expiryDate),
            quantityChange: data.quantityReceived,
            transactionType: "receiving",
            reason: `New batch received - Batch #${data.batchNumber}${data.notes ? ` - ${data.notes}` : ""}`,
            performedBy: data.recordedByUserId,
          });
        }

        return { success: true, data: batchResult };
      } catch (error) {
        Sentry.captureException(error);
        return { success: false, error: String(error) };
      }
    });
  });
