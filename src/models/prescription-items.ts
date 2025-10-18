import db from "@/db";
import {
  DatabaseError,
  executeQuery,
  executeQueryTakeFirst,
  executeQueryTakeFirstOrThrow,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type DomainError,
} from "@/db/helpers";
import { serverOnly } from "@tanstack/react-start";
import { flow, Option, pipe, Effect } from "effect";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  type JSONColumnType,
  sql,
  Transaction,
} from "kysely";
import { isValidUUID, safeJSONParse, toSafeDateString } from "@/lib/utils";
import UserClinicPermissions from "./user-clinic-permissions";
import { v1 as uuidV1 } from "uuid";
import type Clinic from "./clinic";
import type Patient from "./patient";
import User from "./user";

// ============ VALIDATION HELPERS ============

const validateItemId = (id: unknown): Effect.Effect<string, ValidationError> =>
  pipe(
    Effect.succeed(id),
    Effect.filterOrFail(
      (val): val is string => typeof val === "string" && isValidUUID(val),
      () => new ValidationError("Invalid prescription item ID format"),
    ),
  );

const validatePrescriptionId = (
  id: unknown,
): Effect.Effect<string, ValidationError> =>
  pipe(
    Effect.succeed(id),
    Effect.filterOrFail(
      (val): val is string => typeof val === "string" && isValidUUID(val),
      () => new ValidationError("Invalid prescription ID format"),
    ),
  );

const validatePatientId = (
  id: unknown,
): Effect.Effect<string, ValidationError> =>
  pipe(
    Effect.succeed(id),
    Effect.filterOrFail(
      (val): val is string => typeof val === "string" && isValidUUID(val),
      () => new ValidationError("Invalid patient ID format"),
    ),
  );

const validateDrugId = (id: unknown): Effect.Effect<string, ValidationError> =>
  pipe(
    Effect.succeed(id),
    Effect.filterOrFail(
      (val): val is string => typeof val === "string" && isValidUUID(val),
      () => new ValidationError("Invalid drug ID format"),
    ),
  );

const validateClinicId = (
  id: unknown,
): Effect.Effect<string, ValidationError> =>
  pipe(
    Effect.succeed(id),
    Effect.filterOrFail(
      (val): val is string => typeof val === "string" && isValidUUID(val),
      () => new ValidationError("Invalid clinic ID format"),
    ),
  );

const validateQuantity = (
  quantity: unknown,
): Effect.Effect<number, ValidationError> =>
  pipe(
    Effect.succeed(quantity),
    Effect.filterOrFail(
      (val): val is number => typeof val === "number" && val >= 0,
      () =>
        new ValidationError("Invalid quantity - must be a non-negative number"),
    ),
  );

const validatePagination = ({
  limit = 50,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
}): Effect.Effect<{ limit: number; offset: number }, ValidationError> =>
  pipe(
    Effect.succeed({ limit, offset }),
    Effect.filterOrFail(
      ({ limit, offset }) =>
        limit > 0 && limit <= 1000 && offset >= 0 && offset < 1000000,
      () => new ValidationError("Invalid pagination parameters"),
    ),
  );

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
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = true;
    export const name = "prescription_items";
    /** The name of the table in the mobile database */
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

  const withStatus =
    (status: string) =>
    <QB extends { where: any }>(query: QB) =>
      query.where("item_status", "=", status);

  const withPagination =
    ({ limit = 50, offset = 0 }: { limit?: number; offset?: number }) =>
    <QB extends { limit: any; offset: any }>(query: QB) =>
      query.limit(limit).offset(offset);

  const withOrdering =
    (column: string, order: "asc" | "desc" = "asc") =>
    <QB extends { orderBy: any }>(query: QB) =>
      query.orderBy(column, order);

  // ============ PERMISSION CHECKING (Effect-based) ============

  const checkPrescriptionPermission = (
    clinicId: string,
  ): Effect.Effect<void, DomainError> =>
    Effect.tryPromise({
      try: async () => {
        const clinicIds =
          await UserClinicPermissions.API.getClinicIdsWithPermissionFromToken(
            "is_clinic_admin",
          );
        if (!clinicIds.includes(clinicId)) {
          throw new UnauthorizedError("No permission for this clinic");
        }
      },
      catch: (error) => {
        if (error instanceof UnauthorizedError) return error;
        return new DatabaseError("Failed to check permissions", error);
      },
    });

  export namespace API {
    export const getById = serverOnly(
      (
        id: string,
      ): Effect.Effect<ApiPrescriptionItem | undefined, DomainError> =>
        pipe(
          validateItemId(id),
          Effect.flatMap((validId) =>
            executeQueryTakeFirst(
              baseQuery().selectAll().where("id", "=", validId),
            ),
          ),
          Effect.map((result) => result as ApiPrescriptionItem | undefined),
        ),
    );

    export const getByPrescriptionId = serverOnly(
      (
        prescriptionId: string,
        params: { limit?: number; offset?: number } = {},
      ): Effect.Effect<ApiPrescriptionItem[], DomainError> =>
        pipe(
          Effect.all({
            prescriptionId: validatePrescriptionId(prescriptionId),
            pagination: validatePagination(params),
          }),
          Effect.flatMap(({ prescriptionId, pagination }) => {
            const { limit, offset } = pagination;
            const query = flow(
              () => baseQuery().selectAll(),
              (q) => q.where("prescription_id", "=", prescriptionId),
              withOrdering("id"),
              withPagination({ limit, offset }),
            )();
            return executeQuery(query);
          }),
          Effect.map((results) => results as ApiPrescriptionItem[]),
        ),
    );

    export const getByPatientId = serverOnly(
      (
        patientId: string,
        params: { status?: string; limit?: number; offset?: number } = {},
      ): Effect.Effect<ApiPrescriptionItem[], DomainError> =>
        pipe(
          Effect.all({
            patientId: validatePatientId(patientId),
            pagination: validatePagination(params),
          }),
          Effect.flatMap(({ patientId, pagination }) => {
            const { limit, offset } = pagination;
            const query = flow(
              () => baseQuery().selectAll(),
              (q) => q.where("patient_id", "=", patientId),
              params.status ? withStatus(params.status) : (x: any) => x,
              withOrdering("id", "desc"),
              withPagination({ limit, offset }),
            )();
            return executeQuery(query);
          }),
          Effect.map((results) => results as ApiPrescriptionItem[]),
        ),
    );

    export const getByClinicId = serverOnly(
      (
        clinicId: string,
        params: { status?: string; limit?: number; offset?: number } = {},
      ): Effect.Effect<ApiPrescriptionItem[], DomainError> =>
        pipe(
          Effect.all({
            clinicId: validateClinicId(clinicId),
            pagination: validatePagination(params),
          }),
          Effect.flatMap(({ clinicId, pagination }) => {
            const { limit, offset } = pagination;
            const query = flow(
              () => baseQuery().selectAll(),
              (q) => q.where("clinic_id", "=", clinicId),
              params.status ? withStatus(params.status) : (x: any) => x,
              withOrdering("id", "desc"),
              withPagination({ limit, offset }),
            )();
            return executeQuery(query);
          }),
          Effect.map((results) => results as ApiPrescriptionItem[]),
        ),
    );

    export const getActiveItemsForPatient = serverOnly(
      (patientId: string): Effect.Effect<ApiPrescriptionItem[], DomainError> =>
        pipe(
          validatePatientId(patientId),
          Effect.flatMap((validPatientId) =>
            executeQuery(
              baseQuery()
                .selectAll()
                .where("patient_id", "=", validPatientId)
                .where("item_status", "=", "active")
                .orderBy("id", "desc"),
            ),
          ),
          Effect.map((results) => results as ApiPrescriptionItem[]),
        ),
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

    const executeCoreUpsert = (
      item: Partial<ApiPrescriptionItem>,
      trx: Transaction<any>,
    ): Effect.Effect<{ id: string }, DatabaseError> => {
      const id = item.id || uuidV1();
      const values = buildUpsertValues(item, id);

      return executeQueryTakeFirstOrThrow(
        trx
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
          .returning("id"),
      );
    };

    const withTransaction = <T>(
      effect: (trx: Transaction<any>) => Effect.Effect<T, DomainError>,
    ): Effect.Effect<T, DomainError> =>
      Effect.tryPromise({
        try: () =>
          db.transaction().execute(async (trx) => {
            const result = await Effect.runPromise(effect(trx));
            return result;
          }),
        catch: (error) => new DatabaseError("Transaction failed", error),
      });

    export const upsert = serverOnly(
      (
        item: Partial<ApiPrescriptionItem>,
      ): Effect.Effect<{ id: string }, DomainError> =>
        pipe(
          item.clinic_id
            ? checkPrescriptionPermission(item.clinic_id)
            : Effect.succeed(undefined),
          Effect.flatMap(() =>
            withTransaction((trx) => executeCoreUpsert(item, trx)),
          ),
        ),
    );

    export const DANGEROUS_SYNC_ONLY_upsert = serverOnly(
      (
        item: Partial<ApiPrescriptionItem>,
      ): Effect.Effect<{ id: string }, DomainError> =>
        withTransaction((trx) => executeCoreUpsert(item, trx)),
    );

    export const updateQuantityDispensed = serverOnly(
      (
        id: string,
        quantityToAdd: number,
      ): Effect.Effect<ApiPrescriptionItem, DomainError> =>
        pipe(
          Effect.all({
            validId: validateItemId(id),
            validQuantity: validateQuantity(quantityToAdd),
          }),
          Effect.flatMap(({ validId, validQuantity }) =>
            withTransaction(async (trx) => {
              // Get current item
              const current = await Effect.runPromise(
                executeQueryTakeFirstOrThrow(
                  trx
                    .selectFrom(Table.name)
                    .selectAll()
                    .where("id", "=", validId),
                ),
              );

              const newQuantityDispensed =
                (current as ApiPrescriptionItem).quantity_dispensed +
                validQuantity;
              const newRefillsUsed = Math.floor(
                newQuantityDispensed /
                  (current as ApiPrescriptionItem).quantity_prescribed,
              );

              // Update the item
              return executeQueryTakeFirstOrThrow(
                trx
                  .updateTable(Table.name)
                  .set({
                    quantity_dispensed: newQuantityDispensed,
                    refills_used: newRefillsUsed,
                    item_status:
                      newQuantityDispensed >=
                      (current as ApiPrescriptionItem).quantity_prescribed *
                        ((current as ApiPrescriptionItem).refills_authorized +
                          1)
                        ? "completed"
                        : "active",
                  })
                  .where("id", "=", validId)
                  .returningAll(),
              );
            }),
          ),
          Effect.map((result) => result as ApiPrescriptionItem),
        ),
    );

    export const updateStatus = serverOnly(
      (
        id: string,
        status: "active" | "completed" | "cancelled" | "partially_dispensed",
      ): Effect.Effect<ApiPrescriptionItem, DomainError> =>
        pipe(
          validateItemId(id),
          Effect.flatMap((validId) =>
            executeQueryTakeFirstOrThrow(
              db
                .updateTable(Table.name)
                .set({ item_status: status })
                .where("id", "=", validId)
                .returningAll(),
            ),
          ),
          Effect.map((result) => result as ApiPrescriptionItem),
        ),
    );

    export const batchGetByIds = serverOnly(
      (ids: string[]): Effect.Effect<ApiPrescriptionItem[], DomainError> => {
        if (ids.length === 0) return Effect.succeed([]);
        if (ids.length > 100) {
          return Effect.fail(
            new ValidationError("Cannot batch get more than 100 items at once"),
          );
        }

        return pipe(
          Effect.all(ids.map(validateItemId)),
          Effect.flatMap((validIds) =>
            executeQuery(baseQuery().selectAll().where("id", "in", validIds)),
          ),
          Effect.map((results) => results as ApiPrescriptionItem[]),
        );
      },
    );

    export const getStats = serverOnly(
      (
        clinicId: string,
      ): Effect.Effect<
        {
          totalItems: number;
          activeItems: number;
          completedItems: number;
          totalQuantityPrescribed: number;
          totalQuantityDispensed: number;
        },
        DomainError
      > =>
        pipe(
          validateClinicId(clinicId),
          Effect.flatMap((validClinicId) =>
            executeQueryTakeFirstOrThrow(
              db
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
                .where("clinic_id", "=", validClinicId),
            ),
          ),
          Effect.map((result) => ({
            totalItems: Number(result.totalItems) || 0,
            activeItems: Number(result.activeItems) || 0,
            completedItems: Number(result.completedItems) || 0,
            totalQuantityPrescribed:
              Number(result.totalQuantityPrescribed) || 0,
            totalQuantityDispensed: Number(result.totalQuantityDispensed) || 0,
          })),
        ),
    );
  }

  export namespace Sync {
    export const upsertFromDelta = serverOnly(
      (
        items: Partial<ApiPrescriptionItem>[],
      ): Effect.Effect<{ ids: string[] }, DomainError> =>
        Effect.all(
          items.map((item) => API.DANGEROUS_SYNC_ONLY_upsert(item)),
        ).pipe(Effect.map((results) => ({ ids: results.map((r) => r.id) }))),
    );

    export const deleteFromDelta = serverOnly(
      (ids: string[]): Effect.Effect<void, DomainError> =>
        pipe(
          Effect.all(ids.map(validateItemId)),
          Effect.flatMap((validIds) =>
            executeQuery(db.deleteFrom(Table.name).where("id", "in", validIds)),
          ),
          Effect.map(() => undefined),
        ),
    );
  }
}

export default PrescriptionItem;
