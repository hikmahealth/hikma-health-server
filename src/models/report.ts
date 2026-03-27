import db from "@/db";
import { createServerOnlyFn } from "@tanstack/react-start";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  sql,
} from "kysely";
import { uuidv7 } from "uuidv7";
import { subDays } from "date-fns";
import type {
  report as ReportType,
  reportComponent,
  layoutConfig,
  gridPosition,
  componentDisplay,
  timeRange,
} from "@/lib/ai-service/report.gen";

namespace Report {
  // ── Table Types ─────────────────────────────────────────

  export namespace Table {
    export const name = "reports" as const;

    export interface T {
      id: string;
      name: string;
      description: string | null;
      time_range: ColumnType<timeRange, string, string>;
      layout: ColumnType<layoutConfig, string, string>;
      clinic_id: string | null;
      created_by: string | null;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<
        ColumnType<Date, string | undefined, never>
      >;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }

    export type Reports = Selectable<T>;
    export type NewReport = Insertable<T>;
    export type ReportUpdate = Updateable<T>;
  }

  export namespace ComponentTable {
    export const name = "report_components" as const;

    export interface T {
      id: string;
      report_id: string;
      title: string;
      description: string | null;
      prql_source: string;
      compiled_sql: string;
      compiled_at: ColumnType<Date, string | undefined, string>;
      compiler_version: string;
      position: ColumnType<gridPosition, string, string>;
      display: ColumnType<componentDisplay, string, string>;
      time_range: ColumnType<timeRange | null, string | null, string | null>;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }

    export type ReportComponents = Selectable<T>;
    export type NewReportComponent = Insertable<T>;
    export type ReportComponentUpdate = Updateable<T>;
  }

  // ── Time Range Resolution ─────────────────────────────────

  /** Resolve a timeRange to concrete start/end ISO strings */
  export const resolveTimeRange = (
    range: timeRange,
  ): { startAt: string; endAt: string } => {
    if (range.type === "Fixed") {
      return { startAt: range.startAt, endAt: range.endAt };
    }
    return {
      startAt: subDays(new Date(), range.windowDays).toISOString(),
      endAt: new Date().toISOString(),
    };
  };

  // ── Conversions ─────────────────────────────────────────

  /** Convert DB rows into the ReScript-generated `report` shape */
  export const toReportType = (
    row: Table.Reports,
    components: ComponentTable.ReportComponents[],
  ): ReportType => ({
    id: row.id,
    name: row.name,
    ...(row.description != null && { description: row.description }),
    timeRange: row.time_range,
    layout: row.layout,
    components: components.map(toComponentType),
  });

  const toComponentType = (
    row: ComponentTable.ReportComponents,
  ): reportComponent => ({
    id: row.id,
    reportId: row.report_id,
    title: row.title,
    ...(row.description != null && { description: row.description }),
    prqlSource: row.prql_source,
    compiledSql: row.compiled_sql,
    compiledAt:
      row.compiled_at instanceof Date
        ? row.compiled_at.toISOString()
        : String(row.compiled_at),
    compilerVersion: row.compiler_version,
    position: row.position,
    display: row.display,
    ...(row.time_range != null && { timeRange: row.time_range }),
  });

  // ── API ─────────────────────────────────────────────────

  export namespace API {
    /**
     * Upsert a report and its components. Inserts if the report doesn't exist,
     * updates if it does. Components are always replaced atomically.
     */
    export const update = createServerOnlyFn(
      async (input: {
        report: ReportType;
        clinicId?: string | null;
        createdBy?: string | null;
      }): Promise<ReportType> => {
        const { report, clinicId = null, createdBy = null } = input;

        return await db.transaction().execute(async (trx) => {
          const reportRow = await trx
            .insertInto("reports")
            .values({
              id: report.id,
              name: report.name,
              description: report.description ?? null,
              time_range: JSON.stringify(report.timeRange),
              layout: JSON.stringify(report.layout),
              clinic_id: clinicId,
              created_by: createdBy,
            })
            .onConflict((oc) =>
              oc.column("id").doUpdateSet({
                name: report.name,
                description: report.description ?? null,
                time_range: JSON.stringify(report.timeRange),
                layout: JSON.stringify(report.layout),
                updated_at: sql`now()::timestamp with time zone`,
                last_modified: sql`now()::timestamp with time zone`,
              }),
            )
            .returningAll()
            .executeTakeFirstOrThrow();

          // Replace all components: delete old, insert new
          await trx
            .deleteFrom("report_components")
            .where("report_id", "=", report.id)
            .execute();

          let componentRows: ComponentTable.ReportComponents[] = [];
          if (report.components.length > 0) {
            componentRows = await trx
              .insertInto("report_components")
              .values(
                report.components.map((c) => ({
                  id: c.id || uuidv7(),
                  report_id: report.id,
                  title: c.title,
                  description: c.description ?? null,
                  prql_source: c.prqlSource,
                  compiled_sql: c.compiledSql,
                  compiled_at: c.compiledAt,
                  compiler_version: c.compilerVersion,
                  position: JSON.stringify(c.position),
                  display: JSON.stringify(c.display),
                  time_range: c.timeRange
                    ? JSON.stringify(c.timeRange)
                    : null,
                })),
              )
              .returningAll()
              .execute();
          }

          return toReportType(reportRow, componentRows);
        });
      },
    );

    /**
     * Get a report by ID with its components
     */
    export const getById = createServerOnlyFn(
      async (id: string): Promise<ReportType | null> => {
        const reportRow = await db
          .selectFrom("reports")
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .selectAll()
          .executeTakeFirst();

        if (!reportRow) return null;

        const componentRows = await db
          .selectFrom("report_components")
          .where("report_id", "=", id)
          .where("is_deleted", "=", false)
          .selectAll()
          .orderBy("created_at", "asc")
          .execute();

        return toReportType(reportRow, componentRows);
      },
    );

    /**
     * List all non-deleted reports (without components, for listing pages)
     */
    export const getAll = createServerOnlyFn(
      async (clinicId?: string | null): Promise<Table.Reports[]> => {
        let query = db
          .selectFrom("reports")
          .where("is_deleted", "=", false)
          .orderBy("updated_at", "desc")
          .selectAll();

        if (clinicId) {
          query = query.where("clinic_id", "=", clinicId);
        }

        return await query.execute();
      },
    );

    /**
     * Soft delete a report and its components
     */
    export const softDelete = createServerOnlyFn(
      async (id: string): Promise<void> => {
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("report_components")
            .set({
              is_deleted: true,
              deleted_at: sql`now()::timestamp with time zone`,
              updated_at: sql`now()::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
            })
            .where("report_id", "=", id)
            .execute();

          await trx
            .updateTable("reports")
            .set({
              is_deleted: true,
              deleted_at: sql`now()::timestamp with time zone`,
              updated_at: sql`now()::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
            })
            .where("id", "=", id)
            .execute();
        });
      },
    );
  }
}

export default Report;
