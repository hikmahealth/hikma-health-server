import { z } from "zod";

// ── Input types (from EHR server) ──────────────────────────

export type table_schema = {
  name: string;
  is_view: boolean;
  schema: string;
  columns: {
    name: string;
    data_type: string;
    data_type_schema: string;
    is_nullable: boolean;
    is_auto_incrementing: boolean;
    has_default_value: boolean;
  }[];
};

export type patient_registration_form = any[];
export type event_form = any[];

export type manager_report_request = {
  user_prompt: string;
  patient_registration_form: patient_registration_form;
  event_forms: event_form[];
  db_schema: table_schema[];
  report?: report;
  ai_api_key?: string;
};

export type component_request = {
  user_prompt: string;
  patient_registration_form: patient_registration_form;
  event_forms: event_form[];
  db_schema: table_schema[];
  ai_api_key?: string;
  /** When present, the LLM edits this component. When absent, it creates from scratch. */
  component?: {
    title: string;
    description: string;
    prql_source: string;
    display: any;
    position: any;
  };
};

// ── Display config types ───────────────────────────────────

export type format = "Number" | "Currency" | "Percent" | "Date";
export type sort_dir = "Asc" | "Desc";
export type orientation = "Vertical" | "Horizontal";

export type table_column = {
  readonly key: string;
  readonly label: string;
  readonly format?: format;
  readonly sortable?: boolean;
};

export type table_config = { readonly columns: table_column[] };

export type bar_chart_config = {
  readonly x_axis: string;
  readonly y_axis: string;
  readonly orientation?: orientation;
  readonly stacked?: boolean;
  readonly sort_by?: string;
  readonly sort_dir?: sort_dir;
};

export type line_chart_config = {
  readonly x_axis: string;
  readonly y_axis: string;
  readonly series_field?: string;
};

export type pie_chart_config = {
  readonly label_field: string;
  readonly value_field: string;
};

export type stat_card_format = "Number" | "Currency" | "Percent";

export type stat_card_config = {
  readonly value_field: string;
  readonly label: string;
  readonly format?: stat_card_format;
  readonly comparison_field?: string;
};

export type component_display =
  | { TAG: "Table"; _0: table_config }
  | { TAG: "BarChart"; _0: bar_chart_config }
  | { TAG: "LineChart"; _0: line_chart_config }
  | { TAG: "PieChart"; _0: pie_chart_config }
  | { TAG: "StatCard"; _0: stat_card_config };

export type grid_position = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type report_component = {
  readonly id: string;
  readonly report_id: string;
  readonly title: string;
  readonly description?: string;
  readonly prql_source: string;
  readonly compiled_sql: string;
  readonly compiled_at: string;
  readonly compiler_version: string;
  readonly position: grid_position;
  readonly display: component_display;
};

export type layout_config = { readonly columns: number };

export type report = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly start_at: string;
  readonly end_at: string;
  readonly layout: layout_config;
  readonly components: report_component[];
};

// ── Zod schemas for structured AI output ───────────────────

const table_column_schema = z.object({
  key: z.string(),
  label: z.string(),
  format: z.enum(["number", "currency", "percent", "date"]).optional(),
  sortable: z.boolean().optional(),
});

const table_display_schema = z.object({
  type: z.literal("table"),
  config: z.object({
    columns: z.array(table_column_schema),
  }),
});

const bar_chart_display_schema = z.object({
  type: z.literal("bar_chart"),
  config: z.object({
    x_axis: z.string(),
    y_axis: z.string(),
    orientation: z.enum(["vertical", "horizontal"]).optional(),
    stacked: z.boolean().optional(),
    sort_by: z.string().optional(),
    sort_dir: z.enum(["asc", "desc"]).optional(),
  }),
});

const line_chart_display_schema = z.object({
  type: z.literal("line_chart"),
  config: z.object({
    x_axis: z.string(),
    y_axis: z.string(),
    series_field: z.string().optional(),
  }),
});

const pie_chart_display_schema = z.object({
  type: z.literal("pie_chart"),
  config: z.object({
    label_field: z.string(),
    value_field: z.string(),
  }),
});

const stat_card_display_schema = z.object({
  type: z.literal("stat_card"),
  config: z.object({
    value_field: z.string(),
    label: z.string(),
    format: z.enum(["number", "currency", "percent"]).optional(),
    comparison_field: z.string().optional(),
  }),
});

const component_display_schema = z.discriminatedUnion("type", [
  table_display_schema,
  bar_chart_display_schema,
  line_chart_display_schema,
  pie_chart_display_schema,
  stat_card_display_schema,
]);

const position_schema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
});

export const report_component_schema = z.object({
  title: z.string(),
  description: z.string(),
  prql_source: z.string(),
  display: component_display_schema,
  position: position_schema,
});

export const ai_report_response_schema = z.object({
  components: z.array(report_component_schema),
});

// ── Prompt refinement response schema ──────────────────────

const prompt_suggestion_schema = z.object({
  refined_prompt: z.string(),
  reasoning: z.string(),
});

export const prompt_refine_response_schema = z.object({
  suggestions: z.array(prompt_suggestion_schema).length(3),
});

// ── Component fix response schema ──────────────────────────

export const component_fix_response_schema = z.object({
  prql_source: z.string(),
});
