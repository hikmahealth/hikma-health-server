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
import { Schema } from "effect";
import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
import type Clinic from "./clinic";
import type Patient from "./patient";
import User from "./user";
import { isValidUUID, safeJSONParse, toSafeDateString } from "@/lib/utils";
import { v1 as uuidV1 } from "uuid";
import Visit from "./visit";

namespace Prescription {
  export const PrioritySchema = Schema.Union(
    Schema.Literal("high"),
    Schema.Literal("low"),
    Schema.Literal("normal"),
    Schema.Literal("emergency"),
  );

  export const priorityValues = ["high", "low", "normal", "emergency"] as const;

  export const StatusSchema = Schema.Union(
    Schema.Literal("pending"),
    Schema.Literal("prepared"),
    Schema.Literal("picked-up"),
    Schema.Literal("not-picked-up"),
    Schema.Literal("partially-picked-up"),
    Schema.Literal("cancelled"),
    Schema.Literal("other"),
  );
  export const statusValues = [
    "pending",
    "prepared",
    "picked-up",
    "not-picked-up",
    "partially-picked-up",
    "cancelled",
    "other",
  ] as const;

  export const PrescriptionSchema = Schema.Struct({
    id: Schema.String,
    patient_id: Schema.String,
    provider_id: Schema.String,
    filled_by: Schema.OptionFromNullOr(Schema.String),
    pickup_clinic_id: Schema.String,
    visit_id: Schema.OptionFromNullOr(Schema.String),
    priority: PrioritySchema,
    expiration_date: Schema.OptionFromNullOr(Schema.DateFromSelf),
    prescribed_at: Schema.DateFromSelf,
    filled_at: Schema.OptionFromNullOr(Schema.DateFromSelf),
    status: StatusSchema,
    items: Schema.Array(Schema.Unknown),
    notes: Schema.String,
    metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    is_deleted: Schema.Boolean,
    created_at: Schema.DateFromSelf,
    updated_at: Schema.DateFromSelf,
    deleted_at: Schema.OptionFromNullOr(Schema.DateFromSelf),
    last_modified: Schema.DateFromSelf,
    server_created_at: Schema.DateFromSelf,
  });

  export type T = typeof PrescriptionSchema.Type;
  export type EncodedT = typeof PrescriptionSchema.Encoded;

  export namespace Table {
    /**
     * If set to true, this table is always pushed regardless of the the last sync date times. All sync events push to mobile the latest table.
     * IMPORTANT: If ALWAYS_PUSH_TO_MOBILE is true, content of the table should never be edited on the client or pushed to the server from mobile. its one way only.
     * */
    export const ALWAYS_PUSH_TO_MOBILE = false;
    export const name = "prescriptions";
    /** The name of the table in the mobile database */
    export const mobileName = "prescriptions";

    export const columns = {
      id: "id",
      patient_id: "patient_id",
      provider_id: "provider_id",
      filled_by: "filled_by",
      pickup_clinic_id: "pickup_clinic_id",
      visit_id: "visit_id",
      priority: "priority",
      expiration_date: "expiration_date",
      prescribed_at: "prescribed_at",
      filled_at: "filled_at",
      status: "status",
      items: "items",
      notes: "notes",
      metadata: "metadata",
      is_deleted: "is_deleted",
      created_at: "created_at",
      updated_at: "updated_at",
      deleted_at: "deleted_at",
      last_modified: "last_modified",
      server_created_at: "server_created_at",
    };

    export interface T {
      id: string;
      patient_id: string;
      provider_id: string;
      filled_by: string | null;
      pickup_clinic_id: string;
      visit_id: string | null;
      priority: string | null;
      expiration_date: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      prescribed_at: Generated<ColumnType<Date, string | undefined, never>>;
      filled_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      status: Generated<string>;
      items: JSONColumnType<Array<unknown>>;
      notes: Generated<string>;
      metadata: JSONColumnType<Record<string, unknown>>;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<ColumnType<Date, string | undefined, never>>;
    }

    export type Prescriptions = Selectable<T>;
    export type NewPrescriptions = Insertable<T>;
    export type PrescriptionsUpdate = Updateable<T>;
  }

  export namespace API {
    export const getAll = serverOnly(
      async (): Promise<Prescription.EncodedT[]> => {
        const res = await db
          .selectFrom(Prescription.Table.name)
          .where("is_deleted", "=", false)
          .selectAll()
          .execute();

        return res as unknown as Prescription.EncodedT[];
      },
    );

    export const toggleStatus = serverOnly(
      async (id: string, status: string) => {
        await db
          .updateTable(Prescription.Table.name)
          .set({
            status,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", id)
          .execute();
      },
    );

    export const getAllWithDetails = serverOnly(async () => {
      const res = await db.executeQuery<{
        prescription: Prescription.EncodedT;
        patient: Patient.EncodedT;
        clinic: Clinic.EncodedT;
        provider: User.EncodedT;
      }>(
        sql`
        SELECT
          row_to_json(prescriptions.*) as prescription,
          row_to_json(patients.*) as patient,
          row_to_json(clinics.*) as clinic,
          row_to_json(users.*) as provider
        FROM prescriptions
        INNER JOIN patients ON prescriptions.patient_id = patients.id
        INNER JOIN clinics ON prescriptions.clinic_id = clinics.id
        INNER JOIN users ON prescriptions.provider_id = users.id
        WHERE prescriptions.is_deleted = false
      `.compile(db),
      );

      return res.rows;
    });

    /**
     * Save a prescription - this is an upsert operation
     */
    export const save = serverOnly(
      async (
        id: string | null,
        prescription: Prescription.EncodedT,
        currentUserName: string,
        currentClinicId: string,
      ) => {
        try {
          return await db.transaction().execute(async (trx) => {
            let visitId =
              prescription.visit_id && isValidUUID(prescription.visit_id)
                ? prescription.visit_id
                : null;

            // If there is no visit Id, create a new visit
            if (!visitId) {
              let newVisitId = uuidV1();
              const visit = await trx
                .insertInto(Visit.Table.name)
                .values({
                  id: newVisitId,
                  patient_id: prescription.patient_id,
                  clinic_id: currentClinicId,
                  provider_id: prescription.provider_id, // the user_id is that of the current user, to a visit that is the provider
                  is_deleted: false,
                  created_at: sql`now()::timestamp with time zone`,
                  updated_at: sql`now()::timestamp with time zone`,
                  last_modified: sql`now()::timestamp with time zone`,
                  server_created_at: sql`now()::timestamp with time zone`,
                  deleted_at: null,
                  metadata: {} as any,
                  provider_name: currentUserName,
                })
                .returningAll()
                .executeTakeFirstOrThrow();

              visitId = newVisitId;
            }

            // If there is no pickup_clinic_id, set it to the current clinic_id or the clinic_id that the provider works for
            let pickupClinicId = prescription.pickup_clinic_id;
            if (!pickupClinicId || !isValidUUID(pickupClinicId)) {
              const provider = await trx
                .selectFrom(User.Table.name)
                .select("clinic_id")
                .where("id", "=", prescription.provider_id)
                .executeTakeFirstOrThrow();
              if (!provider.clinic_id) {
                throw new Error(
                  "Provider has no clinic_id, and appointment has no pickup_clinic_id",
                );
              }
              pickupClinicId = provider.clinic_id;
            }

            const res = await trx
              .insertInto(Prescription.Table.name)
              .values({
                id: id || prescription.id || uuidV1(),
                patient_id: prescription.patient_id,
                provider_id: prescription.provider_id,
                pickup_clinic_id: pickupClinicId,
                filled_by: prescription.filled_by || null,
                visit_id: visitId,
                priority: prescription.priority,
                expiration_date: prescription.expiration_date
                  ? sql`${toSafeDateString(
                      prescription.expiration_date,
                    )}::timestamp with time zone`
                  : null,
                prescribed_at: sql`${toSafeDateString(
                  prescription.prescribed_at,
                )}::timestamp with time zone`,
                filled_at: prescription.filled_at
                  ? sql`${toSafeDateString(
                      prescription.filled_at,
                    )}::timestamp with time zone`
                  : null,
                status: prescription.status,
                items: sql`${JSON.stringify(
                  safeJSONParse(prescription.items, []),
                )}::jsonb`,
                notes: prescription.notes || "",
                metadata: {} as any,
                is_deleted: false,
                created_at: sql`${toSafeDateString(
                  prescription.created_at,
                )}::timestamp with time zone`,
                updated_at: sql`${toSafeDateString(
                  prescription.updated_at,
                )}::timestamp with time zone`,
                last_modified: sql`now()::timestamp with time zone`,
                server_created_at: sql`now()::timestamp with time zone`,
                deleted_at: null,
              })
              .onConflict((oc) => {
                return oc.column("id").doUpdateSet({
                  patient_id: (eb) => eb.ref("excluded.patient_id"),
                  provider_id: (eb) => eb.ref("excluded.provider_id"),
                  pickup_clinic_id: (eb) => eb.ref("excluded.pickup_clinic_id"),
                  filled_by: (eb) => eb.ref("excluded.filled_by"),
                  visit_id: (eb) => eb.ref("excluded.visit_id"),
                  priority: (eb) => eb.ref("excluded.priority"),
                  expiration_date: (eb) => eb.ref("excluded.expiration_date"),
                  status: (eb) => eb.ref("excluded.status"),
                  items: (eb) => eb.ref("excluded.items"),
                  notes: (eb) => eb.ref("excluded.notes"),
                  metadata: (eb) => eb.ref("excluded.metadata"),
                  updated_at: sql`${toSafeDateString(
                    prescription.updated_at,
                  )}::timestamp with time zone`,
                  last_modified: sql`now()::timestamp with time zone`,
                });
              })
              .executeTakeFirstOrThrow();

            return res;
          });
        } catch (error) {
          console.error("Prescription save operation failed:", {
            operation: "prescription_save",
            error: {
              message: error instanceof Error ? error.message : String(error),
              name: error instanceof Error ? error.constructor.name : "Unknown",
              stack: error instanceof Error ? error.stack : undefined,
            },
            context: {
              prescriptionId: id || prescription.id,
              patientId: prescription.patient_id,
              providerId: prescription.provider_id,
              clinicId: currentClinicId,
              hasValidVisitId: !!(
                prescription.visit_id && isValidUUID(prescription.visit_id)
              ),
            },
            timestamp: new Date().toISOString(),
          });
          throw error;
        }
      },
    );

    /**
     * Soft delete a prescription. ITs an update operation -
     */
    export const softDelete = serverOnly(async (id: string) => {
      await db
        .updateTable(Prescription.Table.name)
        .set({
          is_deleted: true,
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
        })
        .where("id", "=", id)
        .execute();
    });
  }

  export namespace Sync {
    export const upsertFromDelta = serverOnly(
      async (delta: Prescription.EncodedT) => {
        return API.save(delta.id || uuidV1(), delta, "", "");
      },
    );

    export const deleteFromDelta = serverOnly(async (id: string) => {
      return API.softDelete(id);
    });
  }
}

export default Prescription;
