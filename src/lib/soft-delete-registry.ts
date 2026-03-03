import type { Database, TableName } from "@/db";
import type { Transaction } from "kysely";
import { sql } from "kysely";

type SoftDeleteDep = {
  table: TableName;
  foreignKey: string;
};

/**
 * Registry of soft-delete cascade dependencies.
 * When a parent row is soft-deleted, all rows in dependent tables
 * matching on the foreign key are also soft-deleted.
 *
 * To add a new dependency: append to the appropriate parent's array.
 */
export const SOFT_DELETE_DEPENDENCIES: Record<string, SoftDeleteDep[]> = {
  patients: [
    { table: "patient_additional_attributes", foreignKey: "patient_id" },
    { table: "appointments", foreignKey: "patient_id" },
    { table: "prescriptions", foreignKey: "patient_id" },
    { table: "events", foreignKey: "patient_id" },
    { table: "visits", foreignKey: "patient_id" },
    { table: "prescription_items", foreignKey: "patient_id" },
    { table: "patient_vitals", foreignKey: "patient_id" },
    { table: "patient_problems", foreignKey: "patient_id" },
    { table: "patient_observations", foreignKey: "patient_id" },
  ],
  visits: [
    { table: "prescriptions", foreignKey: "visit_id" },
    { table: "events", foreignKey: "visit_id" },
    { table: "appointments", foreignKey: "current_visit_id" },
  ],
};

/**
 * Cascade soft-delete across all registered dependent tables for a given parent.
 * Must be called within an existing transaction.
 */
export const cascadeSoftDelete = async (
  trx: Transaction<Database>,
  parentTable: string,
  ids: string | string[],
): Promise<void> => {
  const deps = SOFT_DELETE_DEPENDENCIES[parentTable];
  if (!deps) {
    throw new Error(
      `No soft-delete dependencies registered for table "${parentTable}".`,
    );
  }

  const idArray = Array.isArray(ids) ? ids : [ids];

  for (const dep of deps) {
    await trx
      .updateTable(dep.table)
      // @ts-ignore — dynamic column name
      .set({
        is_deleted: true,
        updated_at: sql`now()::timestamp with time zone`,
        last_modified: sql`now()::timestamp with time zone`,
      })
      .where(dep.foreignKey, "in", idArray)
      .execute();
  }
};

/** Get the dependency list for a parent table (useful in tests). */
export const getDependencies = (
  parentTable: string,
): SoftDeleteDep[] | undefined => SOFT_DELETE_DEPENDENCIES[parentTable];
