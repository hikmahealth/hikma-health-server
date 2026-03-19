import { createServerFn } from "@tanstack/react-start";
import Appointment from "@/models/appointment";
import User from "@/models/user";
import {
  constructLayoutConfig,
  constructReport,
  constructReportComponent,
  type report as Report,
  type reportComponent,
  type componentDisplay,
  type gridPosition,
} from "./report.gen";
import PatientRegistrationForm from "@/models/patient-registration-form";
import EventForm from "@/models/event-form";
import PatientVital from "@/models/patient-vital";
import PatientProblem from "@/models/patient-problem";
import Patient from "@/models/patient";
import PatientAdditionalAttribute from "@/models/patient-additional-attribute";
import { userRoleTokenHasCapability } from "../auth/request";
import db from "@/db";
import Event from "@/models/event";
import Visit from "@/models/visit";
import Clinic from "@/models/clinic";
import { uuidv7 } from "uuidv7";
import { subDays } from "date-fns";
import type { TableMeta } from "@tanstack/react-table";
import { sql, type TableMetadata } from "kysely";

// ── AI Response Types (snake_case from the AI service) ─────

type AIDisplayConfig = {
  type: string;
  config: Record<string, unknown>;
};

type AIReportComponent = {
  title: string;
  description?: string;
  prql_source: string;
  compiled_sql: string;
  compile_error: string | null;
  display: AIDisplayConfig;
  position: { x: number; y: number; w: number; h: number };
};

// ── Parsing ────────────────────────────────────────────────

const parseFormat = (f: unknown) => {
  if (f === "number") return "Number" as const;
  if (f === "currency") return "Currency" as const;
  if (f === "percent") return "Percent" as const;
  return undefined;
};

const parseTableFormat = (f: unknown) => {
  const base = parseFormat(f);
  if (base) return base;
  if (f === "date") return "Date" as const;
  return undefined;
};

const parseOrientation = (o: unknown) => {
  if (o === "horizontal") return "Horizontal" as const;
  if (o === "vertical") return "Vertical" as const;
  return undefined;
};

const parseSortDir = (d: unknown) => {
  if (d === "asc") return "Asc" as const;
  if (d === "desc") return "Desc" as const;
  return undefined;
};

export const parseDisplayType = (
  display: AIDisplayConfig,
): componentDisplay | null => {
  const { type, config } = display;

  switch (type) {
    case "stat_card":
      return {
        TAG: "StatCard",
        _0: {
          valueField: config.value_field as string,
          label: config.label as string,
          ...(config.format != null && { format: parseFormat(config.format) }),
          ...(config.comparison_field != null && {
            comparisonField: config.comparison_field as string,
          }),
        },
      };

    case "table":
      return {
        TAG: "Table",
        _0: {
          columns: (config.columns as any[]).map((col) => ({
            key: col.key as string,
            label: col.label as string,
            ...(col.format != null && { format: parseTableFormat(col.format) }),
            ...(col.sortable != null && { sortable: col.sortable as boolean }),
          })),
        },
      };

    case "line_chart":
      return {
        TAG: "LineChart",
        _0: {
          xAxis: config.x_axis as string,
          yAxis: config.y_axis as string,
          ...(config.series_field != null && {
            seriesField: config.series_field as string,
          }),
        },
      };

    case "pie_chart":
      return {
        TAG: "PieChart",
        _0: {
          labelField: config.label_field as string,
          valueField: config.value_field as string,
        },
      };

    case "bar_chart":
      return {
        TAG: "BarChart",
        _0: {
          xAxis: config.x_axis as string,
          yAxis: config.y_axis as string,
          ...(config.orientation != null && {
            orientation: parseOrientation(config.orientation),
          }),
          ...(config.stacked != null && { stacked: config.stacked as boolean }),
          ...(config.sort_by != null && { sortBy: config.sort_by as string }),
          ...(config.sort_dir != null && {
            sortDir: parseSortDir(config.sort_dir),
          }),
        },
      };

    default:
      return null;
  }
};

export const parseAIReportComponent = (
  raw: AIReportComponent,
  reportId: string,
): reportComponent | null => {
  if (raw.compile_error) return null;

  const display = parseDisplayType(raw.display);
  if (!display) return null;

  return {
    id: uuidv7(),
    reportId,
    title: raw.title,
    ...(raw.description != null && { description: raw.description }),
    prqlSource: raw.prql_source,
    compiledSql: raw.compiled_sql,
    compiledAt: new Date().toISOString(),
    compilerVersion: "0.1.0",
    position: raw.position,
    display,
  };
};

export const parseAIResponse = (
  components: AIReportComponent[],
  reportId: string,
): reportComponent[] =>
  components.reduce<reportComponent[]>((acc, raw) => {
    const parsed = parseAIReportComponent(raw, reportId);
    return parsed ? [...acc, parsed] : acc;
  }, []);

// ── SQL Execution ──────────────────────────────────────────

export type ComponentData = {
  componentId: string;
  rows: Record<string, unknown>[];
  error: string | null;
};

const executeComponentQuery = async (
  compiledSql: string,
): Promise<Record<string, unknown>[]> => {
  const rows = await db.transaction().execute(async (trx) => {
    await sql`SET TRANSACTION READ ONLY`.execute(trx);
    const result = await sql
      .raw<Record<string, unknown>>(compiledSql)
      .execute(trx);
    return result.rows;
  });
  return rows;
};

const fetchAllComponentData = async (
  components: reportComponent[],
): Promise<ComponentData[]> =>
  Promise.all(
    components.map(async (c) => {
      try {
        const rows = await executeComponentQuery(c.compiledSql);
        return { componentId: c.id, rows, error: null };
      } catch (err: any) {
        return {
          componentId: c.id,
          rows: [],
          error: err?.message ?? "Query failed",
        };
      }
    }),
  );

export type ReportWithData = {
  report: Report;
  data: ComponentData[];
};

// TABLE DATA TO INCLUDE IN REPORTING
const INCLUDED_TABLES = [
  PatientAdditionalAttribute.Table.name,
  Patient.Table.name,
  PatientVital.Table.name,
  PatientProblem.Table.name,
  PatientProblem.Table.name,
  Event.Table.name,
  Visit.Table.name,
  User.Table.name,
  Clinic.Table.name,
];

const tempURL = "http://localhost:3003";

type ManagerReportRequest = {
  user_prompt: string;
  patient_registration_form: Record<string, unknown>;
  event_forms: any[];
  db_schema: TableMetadata[];
  report?: Record<string, unknown>;
};

/**
 * Update (or create) a report using the hh ai service
 *  * @returns {Promise<Report>} - The updated report
 */
export const editReport = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { report_id?: string; user_description: string }) =>
      data || {
        reportId: null,
        user_description: "Create a report that matches this.",
      },
  )
  .handler(async ({ data }): Promise<ReportWithData> => {
    const authorized = await userRoleTokenHasCapability([
      User.CAPABILITIES.READ_ALL_PATIENT,
    ]);

    if (!authorized) {
      return Promise.reject({
        message: "Unauthorized: Insufficient permissions",
        source: "getPatientVitals",
      });
    }
    const patient_registration_forms = await PatientRegistrationForm.getAll(); // need to eventually pick just one
    const event_forms = await EventForm.API.getAll();

    const tables = (
      await db.introspection.getTables({
        withInternalKyselyTables: false,
      })
    ).filter((table) => INCLUDED_TABLES.includes(table.name));

    // TODO: Validate that the TABE.Table.columns is a good match

    console.log(
      JSON.stringify(
        {
          patient_registration_forms,
          event_forms,
          tables,
        },
        null,
        2,
      ),
    );

    const reportId = uuidv7();
    const reportName = "Test Report";
    const reportDescription = "This is a test description";
    const startAt = subDays(new Date(), 100).toISOString();
    const endAt = new Date().toISOString();

    const layout = constructLayoutConfig(12);
    // const component = constructReportComponent(
    //   id: string, reportId: string, title: string, description: string, prqlSource: string, compiledSql: string, compiledAt: string, compilerVersion: string, position: gridPosition, display: componentDisplay
    // )
    const reportComponents: reportComponent[] = []; // empty on initial

    const initialReport = constructReport(
      reportId,
      reportName,
      reportDescription,
      startAt,
      endAt,
      layout,
      reportComponents,
    );

    const aiRequest: ManagerReportRequest = {
      user_prompt: data.user_description,
      db_schema: tables,
      event_forms,
      patient_registration_form: patient_registration_forms[0],
      report: initialReport,
    };

    const res = await fetch(`${tempURL}/reports/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiRequest),
    });

    if (!res.ok) {
      return Promise.reject({
        message: `AI service error: ${res.status}`,
        source: "editReport",
      });
    }

    const aiResponse = await res.json();
    const aiComponents: AIReportComponent[] = Array.isArray(aiResponse)
      ? aiResponse
      : (aiResponse.components ?? []);
    const parsedComponents = parseAIResponse(aiComponents, reportId);

    const report = constructReport(
      reportId,
      reportName,
      reportDescription,
      startAt,
      endAt,
      layout,
      parsedComponents,
    );

    const data_ = await fetchAllComponentData(parsedComponents);
    return { report, data: data_ };
  });
