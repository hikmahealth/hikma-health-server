import db from "@/db";
import { createServerOnlyFn } from "@tanstack/react-start";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  type JSONColumnType,
  sql,
} from "kysely";
import { isValidUUID, toSafeDateString } from "@/lib/utils";
import { v1 as uuidV1 } from "uuid";
import type Patient from "./patient";
import type User from "./user";
import type PrescriptionItem from "./prescription-items";
import DrugCatalogue from "./drug-catalogue";

namespace DispensingRecord {
  export interface DispensingRecordData {
    id: string;
    clinic_id: string;
    drug_id: string;
    batch_id: string | null;
    prescription_item_id: string | null;
    patient_id: string;
    quantity_dispensed: number;
    dosage_instructions: string | null;
    days_supply: number | null;
    dispensed_by: string;
    dispensed_at: Date;
    recorded_by_user_id: string | null;
    metadata: Record<string, unknown>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Date | null;
  }

  /**
   * Convert database record to encoded format
   * @param record - Database record
   * @returns Encoded record with date strings
   */
  const fromDbRecord = (record: Table.DispensingRecords): EncodedT => {
    return {
      ...record,
      dispensed_at: (record.dispensed_at as any as Date).toISOString(),
      created_at: (record.created_at as any as Date).toISOString(),
      updated_at: (record.updated_at as any as Date).toISOString(),
      last_modified: (record.last_modified as any as Date).toISOString(),
      server_created_at: (
        record.server_created_at as any as Date
      ).toISOString(),
      deleted_at: record.deleted_at
        ? (record.deleted_at as any as Date).toISOString()
        : null,
      metadata: record.metadata as Record<string, unknown>,
    };
  };

  export type T = DispensingRecordData;
  export type EncodedT = {
    id: string;
    clinic_id: string;
    drug_id: string;
    batch_id: string | null;
    prescription_item_id: string | null;
    patient_id: string;
    quantity_dispensed: number;
    dosage_instructions: string | null;
    days_supply: number | null;
    dispensed_by: string;
    dispensed_at: string;
    recorded_by_user_id: string | null;
    metadata: Record<string, unknown>;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
    last_modified: string;
    server_created_at: string;
    deleted_at: string | null;
  };

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times.
     */
    export const ALWAYS_PUSH_TO_MOBILE = false;
    export const name = "dispensing_records";
    /** The name of the table in the mobile database */
    export const mobileName = "dispensing_records";

    export const columns = {
      id: "id",
      clinic_id: "clinic_id",
      drug_id: "drug_id",
      batch_id: "batch_id",
      prescription_item_id: "prescription_item_id",
      patient_id: "patient_id",
      quantity_dispensed: "quantity_dispensed",
      dosage_instructions: "dosage_instructions",
      days_supply: "days_supply",
      dispensed_by: "dispensed_by",
      dispensed_at: "dispensed_at",
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
      batch_id: string | null;
      prescription_item_id: string | null;
      patient_id: string;
      quantity_dispensed: number;
      dosage_instructions: string | null;
      days_supply: number | null;
      dispensed_by: string;
      dispensed_at: ColumnType<Date, string | undefined, string>;
      recorded_by_user_id: string | null;
      metadata: JSONColumnType<Record<string, unknown>>;
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

    export type DispensingRecords = Selectable<T>;
    export type NewDispensingRecords = Insertable<T>;
    export type DispensingRecordsUpdate = Updateable<T>;
  }

  export namespace API {
    /**
     * Get dispensing record by ID
     * @param id - Record ID
     * @returns Dispensing record or null
     */
    export const getById = createServerOnlyFn(
      async (id: string): Promise<DispensingRecord.EncodedT | null> => {
        if (!id || !isValidUUID(id)) {
          return null;
        }

        const record = await db
          .selectFrom(DispensingRecord.Table.name)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .selectAll()
          .executeTakeFirst();

        return record ? fromDbRecord(record) : null;
      },
    );

    /**
     * Get all dispensing records for a patient
     * @param patientId - Patient ID
     * @param limit - Max records to return
     * @param offset - Pagination offset
     * @returns Array of dispensing records
     */
    export const getByPatientId = createServerOnlyFn(
      async (
        patientId: string,
        limit = 50,
        offset = 0,
      ): Promise<DispensingRecord.EncodedT[]> => {
        if (!patientId || !isValidUUID(patientId)) {
          return [];
        }

        const records = await db
          .selectFrom(DispensingRecord.Table.name)
          .where("patient_id", "=", patientId)
          .where("is_deleted", "=", false)
          .orderBy("dispensed_at", "desc")
          .limit(limit)
          .offset(offset)
          .selectAll()
          .execute();

        return records.map(fromDbRecord);
      },
    );

    /**
     * Get dispensing records by prescription item ID
     * @param prescriptionItemId - Prescription item ID
     * @returns Array of dispensing records
     */
    export const getByPrescriptionItemId = createServerOnlyFn(
      async (
        prescriptionItemId: string,
      ): Promise<DispensingRecord.EncodedT[]> => {
        if (!prescriptionItemId || !isValidUUID(prescriptionItemId)) {
          return [];
        }

        const records = await db
          .selectFrom(DispensingRecord.Table.name)
          .where("prescription_item_id", "=", prescriptionItemId)
          .where("is_deleted", "=", false)
          .orderBy("dispensed_at", "desc")
          .selectAll()
          .execute();

        return records.map(fromDbRecord);
      },
    );

    /**
     * Get dispensing records for a clinic within date range
     * @param clinicId - Clinic ID
     * @param startDate - Start date
     * @param endDate - End date
     * @returns Array of dispensing records
     */
    export const getByClinicAndDateRange = createServerOnlyFn(
      async (
        clinicId: string,
        startDate: Date,
        endDate: Date,
      ): Promise<DispensingRecord.EncodedT[]> => {
        if (!clinicId || !isValidUUID(clinicId)) {
          return [];
        }

        const records = await db
          .selectFrom(DispensingRecord.Table.name)
          .where("clinic_id", "=", clinicId)
          .where("dispensed_at", ">=", startDate)
          .where("dispensed_at", "<=", endDate)
          .where("is_deleted", "=", false)
          .orderBy("dispensed_at", "desc")
          .selectAll()
          .execute();

        return records.map(fromDbRecord);
      },
    );

    /**
     * Get dispensing records by drug ID
     * @param drugId - Drug ID
     * @param clinicId - Optional clinic ID filter
     * @returns Array of dispensing records
     */
    export const getByDrugId = createServerOnlyFn(
      async (
        drugId: string,
        clinicId?: string,
      ): Promise<DispensingRecord.EncodedT[]> => {
        if (!drugId || !isValidUUID(drugId)) {
          return [];
        }

        let query = db
          .selectFrom(DispensingRecord.Table.name)
          .where("drug_id", "=", drugId)
          .where("is_deleted", "=", false);

        if (clinicId && isValidUUID(clinicId)) {
          query = query.where("clinic_id", "=", clinicId);
        }

        const records = await query
          .orderBy("dispensed_at", "desc")
          .selectAll()
          .execute();

        return records.map(fromDbRecord);
      },
    );

    /**
     * Get dispensing records with full details
     * @param clinicId - Clinic ID
     * @param limit - Max records to return
     * @param offset - Pagination offset
     * @returns Array of records with patient, drug, and user details
     */
    export const getAllWithDetails = createServerOnlyFn(
      async (clinicId: string, limit = 50, offset = 0) => {
        const query = sql`
          SELECT
            row_to_json(dr.*) as dispensing_record,
            row_to_json(p.*) as patient,
            row_to_json(d.*) as drug,
            row_to_json(u.*) as dispensed_by_user,
            row_to_json(pi.*) as prescription_item
          FROM dispensing_records dr
          INNER JOIN patients p ON dr.patient_id = p.id
          INNER JOIN drug_catalogue d ON dr.drug_id = d.id
          INNER JOIN users u ON dr.dispensed_by = u.id
          LEFT JOIN prescription_items pi ON dr.prescription_item_id = pi.id
          WHERE dr.clinic_id = ${clinicId}
            AND dr.is_deleted = false
          ORDER BY dr.dispensed_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        const result = await query.execute(db);
        return result.rows as Array<{
          dispensing_record: DispensingRecord.EncodedT;
          patient: Patient.EncodedT;
          drug: DrugCatalogue.ApiDrug;
          dispensed_by_user: User.EncodedT;
          prescription_item: PrescriptionItem.ApiPrescriptionItem | null;
        }>;
      },
    );

    /**
     * Create or update a dispensing record
     * @param record - Dispensing record data
     * @returns Created/updated record
     */
    export const upsert = createServerOnlyFn(
      async (record: DispensingRecord.EncodedT) => {
        const id = record.id || uuidV1();

        const result = await db
          .insertInto(DispensingRecord.Table.name)
          .values({
            id,
            clinic_id: record.clinic_id,
            drug_id: record.drug_id,
            batch_id: record.batch_id,
            prescription_item_id: record.prescription_item_id,
            patient_id: record.patient_id,
            quantity_dispensed: record.quantity_dispensed,
            dosage_instructions: record.dosage_instructions,
            days_supply: record.days_supply,
            dispensed_by: record.dispensed_by,
            dispensed_at: sql`${toSafeDateString(
              record.dispensed_at,
            )}::timestamp with time zone`,
            recorded_by_user_id: record.recorded_by_user_id,
            metadata: record.metadata as any,
            is_deleted: false,
            created_at: sql`${toSafeDateString(
              record.created_at,
            )}::timestamp with time zone`,
            updated_at: sql`${toSafeDateString(
              record.updated_at,
            )}::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
            server_created_at: sql`now()::timestamp with time zone`,
            deleted_at: null,
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              drug_id: (eb) => eb.ref("excluded.drug_id"),
              batch_id: (eb) => eb.ref("excluded.batch_id"),
              prescription_item_id: (eb) =>
                eb.ref("excluded.prescription_item_id"),
              quantity_dispensed: (eb) => eb.ref("excluded.quantity_dispensed"),
              dosage_instructions: (eb) =>
                eb.ref("excluded.dosage_instructions"),
              days_supply: (eb) => eb.ref("excluded.days_supply"),
              dispensed_by: (eb) => eb.ref("excluded.dispensed_by"),
              dispensed_at: (eb) => eb.ref("excluded.dispensed_at"),
              recorded_by_user_id: (eb) =>
                eb.ref("excluded.recorded_by_user_id"),
              metadata: (eb) => eb.ref("excluded.metadata"),
              updated_at: sql`now()::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
            }),
          )
          .returningAll()
          .executeTakeFirstOrThrow();

        return fromDbRecord(result);
      },
    );

    /**
     * Soft delete a dispensing record
     * @param id - Record ID
     */
    export const softDelete = createServerOnlyFn(async (id: string) => {
      await db
        .updateTable(DispensingRecord.Table.name)
        .set({
          is_deleted: true,
          deleted_at: sql`now()::timestamp with time zone`,
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
        })
        .where("id", "=", id)
        .execute();
    });

    /**
     * Get dispensing statistics for a clinic
     * @param clinicId - Clinic ID
     * @param startDate - Start date
     * @param endDate - End date
     * @returns Statistics object
     */
    export const getStats = createServerOnlyFn(
      async (clinicId: string, startDate: Date, endDate: Date) => {
        const query = sql`
          SELECT
            COUNT(DISTINCT dr.id) as total_dispensed,
            COUNT(DISTINCT dr.patient_id) as unique_patients,
            COUNT(DISTINCT dr.drug_id) as unique_drugs,
            SUM(dr.quantity_dispensed) as total_quantity,
            COUNT(DISTINCT CASE WHEN dr.prescription_item_id IS NOT NULL THEN dr.id END) as prescription_dispensed,
            COUNT(DISTINCT CASE WHEN dr.prescription_item_id IS NULL THEN dr.id END) as otc_dispensed
          FROM dispensing_records dr
          WHERE dr.clinic_id = ${clinicId}
            AND dr.dispensed_at >= ${startDate}
            AND dr.dispensed_at <= ${endDate}
            AND dr.is_deleted = false
        `;

        const result = await query.execute(db);
        return result.rows[0] as {
          total_dispensed: number;
          unique_patients: number;
          unique_drugs: number;
          total_quantity: number;
          prescription_dispensed: number;
          otc_dispensed: number;
        };
      },
    );

    /**
     * Search dispensing records
     * @param searchTerm - Search term
     * @param clinicId - Clinic ID
     * @param limit - Max records to return
     * @returns Array of matching records
     */
    export const search = createServerOnlyFn(
      async (
        searchTerm: string,
        clinicId: string,
        limit = 50,
      ): Promise<DispensingRecord.EncodedT[]> => {
        if (!searchTerm || !clinicId || !isValidUUID(clinicId)) {
          return [];
        }

        const query = sql`
          SELECT dr.*
          FROM dispensing_records dr
          INNER JOIN patients p ON dr.patient_id = p.id
          INNER JOIN drug_catalogue d ON dr.drug_id = d.id
          WHERE dr.clinic_id = ${clinicId}
            AND dr.is_deleted = false
            AND (
              p.given_name ILIKE ${"%" + searchTerm + "%"}
              OR p.surname ILIKE ${"%" + searchTerm + "%"}
              OR d.name ILIKE ${"%" + searchTerm + "%"}
              OR d.brand_name ILIKE ${"%" + searchTerm + "%"}
            )
          ORDER BY dr.dispensed_at DESC
          LIMIT ${limit}
        `;

        const result = await query.execute(db);
        return result.rows as DispensingRecord.EncodedT[];
      },
    );

    /**
     * Batch get records by IDs
     * @param ids - Array of record IDs
     * @returns Array of dispensing records
     */
    export const batchGetByIds = createServerOnlyFn(
      async (ids: string[]): Promise<DispensingRecord.EncodedT[]> => {
        if (!ids || ids.length === 0) {
          return [];
        }

        const validIds = ids.filter(isValidUUID);
        if (validIds.length === 0) {
          return [];
        }

        const records = await db
          .selectFrom(DispensingRecord.Table.name)
          .where("id", "in", validIds)
          .where("is_deleted", "=", false)
          .selectAll()
          .execute();

        return records.map(fromDbRecord);
      },
    );
  }

  export namespace Sync {
    /**
     * Upsert record from sync delta
     * @param delta - Delta record
     * @returns Updated record
     */
    export const upsertFromDelta = createServerOnlyFn(
      async (delta: DispensingRecord.EncodedT) => {
        return API.upsert(delta);
      },
    );

    /**
     * Delete record from sync delta
     * @param id - Record ID
     */
    export const deleteFromDelta = createServerOnlyFn(async (id: string) => {
      return API.softDelete(id);
    });
  }
}

export default DispensingRecord;
