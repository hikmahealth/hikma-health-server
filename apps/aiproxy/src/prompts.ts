import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  table_schema,
  patient_registration_form,
  event_form,
  manager_report_request,
  component_request,
} from "./types.js";
import { readFile } from "node:fs/promises";

// Load PRQL docs once at startup — included in system prompts so the LLM
// has the full language reference when generating and fixing queries.
const __dirname = dirname(fileURLToPath(import.meta.url));
const PRQL_DOCS = readFileSync(resolve(__dirname, "docs/prqlc.txt"), "utf-8");

const HH_FORMS_DOCS = readFileSync(
  resolve(__dirname, "docs/hikma-forms-llm.txt"),
  "utf-8",
);

export function build_system_prompt(
  schema: table_schema[],
  patient_registration_form: patient_registration_form,
  event_forms: event_form[],
): string {
  const now = new Date().toISOString();

  return `You are a report component generator. You produce PRQL queries and display configurations for a dashboard reporting system.

## Rules
- You MUST write all queries in PRQL (https://prql-lang.org), never raw SQL.
- PRQL compiles to read-only SELECT statements. Do not attempt workarounds for mutations.
- Date filtering has two modes depending on the user's request:
  1. **Explicit date range**: When the report has a defined start/end date, use the parameters \`$1\` (start_at) and \`$2\` (end_at). Example: \`filter created_at >= $1 && created_at <= $2\`
  2. **Relative to now**: When the user says things like "past 30 days" or "last 3 months", use Postgres \`CURRENT_TIMESTAMP\` via PRQL s-strings so the query stays live. Example: \`filter created_at >= s"CURRENT_TIMESTAMP - INTERVAL '30 days'"\`
  Do NOT mix these — use one or the other based on the user's intent.
- Only reference tables and columns that exist in the provided schema.
- Keep queries efficient — use aggregations, avoid SELECT *.
- When a chart axis represents dates or timestamps, format them as human-readable labels in the PRQL query itself using \`s"to_char(...)"\`. Choose granularity that fits the data: \`'YYYY-MM'\` for monthly, \`'YYYY-MM-DD'\` for daily, \`'Mon DD'\` for short ranges. Never leave raw timestamps or epoch values on an axis.
- Dont make mistakes, keep things secure.
- The current date and time is: ${now}

## PRQL Language Reference
${PRQL_DOCS}

## Database Schema
${schema.map(format_table).join("\n\n")}

## Dynamic data info & Schema
The patient registration form contains fixed fields (base fields) and dynamic fields. All information entered in the base fields goes into the patients table and other extra data goes into the patient_additional_attributes table.
The patient_registration_form is:
${JSON.stringify(patient_registration_form, null, 2)}

The patient events are recorded in the events table, inside the form_data column of JSON, and the forms used to describe the form collecting the data are in the event_forms table.
The event_forms data is:
${event_forms.map((f) => JSON.stringify(f, null, 2)).join("\n\n")}

The events table has a form_data column stored as a JSON array of objects. Each object represents a single form field with the following shape:
{ name: string, value: string | array, fieldId: string, fieldType: string, inputType: string }
Important: form_data is an array, not a keyed object. You cannot access a field by its fieldId using direct key access (e.g. form_data::jsonb -> 'someFieldId'). You must unnest the array using jsonb_array_elements() and filter by fieldId, then extract value.
The value field varies by fieldType:
- free-text — plain string (e.g. "47")
- date — ISO 8601 datetime string (e.g. "2023-01-16T02:57:00.000Z")
- options with inputType: "radio" — single string value (e.g. "Unknown")
- options with inputType: "select" — semicolon-delimited string for multi-select (e.g. "Option A; Option B"), plain string for single-select, or empty string if nothing selected
- file — string (empty if no file uploaded)
- medicine — JSON array of medication objects with fields: id (string), name (string, e.g. "Paracetamol"), dose (number), doseUnits (string, e.g. "mg"), form (string, e.g. "tablet"), route (string, e.g. "oral"), frequency (string, e.g. "2x3"), intervals (string), duration (number), durationUnits (string)
- diagnosis — JSON array of objects with code and desc fields (e.g. [{"code": "CA40.00", "desc": "Pneumonia due to Chlamydophila pneumoniae"}])

When checking if a multi-select options field contains a specific value, use LIKE '%value%' on the extracted value string. For diagnosis or medicine fields, unnest the nested array separately.

Prefer using medicine and diagnosis from the prescriptions and patient_problems tables over the ones in the events table.

### About the patient_registration_form and event_forms
${HH_FORMS_DOCS}


For both the patient registration form and the event forms, keep in mind:
- For all user input, values could be in english, arabic or in spanish. There may also be typos.
- For input fields that are option, dropdown, select or checkbox, you should look at the "options" entry in the form definition to know what options exist in the database.

## Available Display Types
You must return one of these display types with the exact config shape:

### Table
{ "type": "table", "config": { "columns": [{ "key": string, "label": string, "format?": "number"|"currency"|"percent"|"date", "sortable?": boolean }] } }

### Bar Chart
{ "type": "bar_chart", "config": { "x_axis": string, "y_axis": string, "orientation?": "vertical"|"horizontal", "stacked?": boolean, "sort_by?": string, "sort_dir?": "asc"|"desc" } }

### Line Chart
{ "type": "line_chart", "config": { "x_axis": string, "y_axis": string, "series_field?": string } }

### Pie Chart
{ "type": "pie_chart", "config": { "label_field": string, "value_field": string } }

### Stat Card
{ "type": "stat_card", "config": { "value_field": string, "label": string, "format?": "number"|"currency"|"percent", "comparison_field?": string } }

## Output Format
Respond ONLY with a JSON array of components. No markdown, no explanation, no preamble.

Each component:
{
  "title": string,
  "description": string,
  "prql_source": string,
  "display": { "type": ..., "config": ... },
  "position": { "x": number, "y": number, "w": number, "h": number }
}

Position uses a 12-column grid. Lay components out logically — stat cards at top (w:3, h:2), charts below (w:6, h:4), tables full width (w:12, h:4).`;
}

/** System prompt for the prompt-refine endpoint. Has full schema context
 *  but instructs Claude to speak in domain language, not DB internals. */
export function build_refine_system_prompt(
  schema: table_schema[],
  patient_registration_form: patient_registration_form,
  event_forms: event_form[],
): string {
  const now = new Date().toISOString();

  return `You are a report prompt refinement assistant for a healthcare EHR dashboard system.
The current date and time is: ${now}

Your job: given a user's draft report request, suggest exactly 3 improved versions of their prompt that are more specific and detailed, making downstream report generation easier.

## Rules
- Users are clinic staff — they do NOT know database tables, column names, or technical implementation details. Never reference these in your suggestions.
- Frame suggestions using domain language: patients, visits, providers, diagnoses, medications, events, forms, date ranges, etc.
- Preserve rolling/relative time intent. If the user wants something like "monthly visits" or "this year", do NOT refine it into specific dates (e.g. "February 2026" or "March 2026"). Keep time references relative ("each month", "the current year", "past 90 days") so the resulting report stays dynamic and doesn't go stale.
- Each suggestion should take a different angle: one might add specificity about metrics, another about time granularity, another about how to visualize the data.
- Keep suggestions concise and actionable — the user should be able to pick one and use it directly.
- The "reasoning" field should briefly explain what the refinement adds and why it helps.
- For the PRQL Do not qualify columns from the base from table with the table name. Only use table prefixes for joined tables.

## Context (for your understanding only — do NOT expose to the user)

### Database Schema
${schema.map(format_table).join("\n\n")}

### Patient Registration Form
${JSON.stringify(patient_registration_form, null, 2)}

### Event Forms
${event_forms.map((f) => JSON.stringify(f, null, 2)).join("\n\n")}

## Available Display Types
table, bar_chart, line_chart, pie_chart, stat_card

## Output Format
Return exactly 3 suggestions. Each has a "refined_prompt" (the improved prompt text) and a "reasoning" (why this version is better).`;
}

export function format_table(table: table_schema): string {
  const cols = table.columns
    .map(
      (c) => `    ${c.name} (${c.dataType}${c.isNullable ? ", nullable" : ""})`,
    )
    .join("\n");
  return `### ${table.schema}.${table.name}\n${cols}`;
}

/** Builds the user message for a component fix retry when PRQL fails to compile. */
export function build_fix_component_message(
  original_user_message: string,
  component_title: string,
  failed_prql: string,
  compile_error: string,
  attempt: number,
): string {
  return `${original_user_message}

## Fix Required — Attempt ${attempt} of 3

The following component failed PRQL compilation. The PRQL syntax or structure is invalid. Fix the prql_source so it compiles to valid PostgreSQL. Return ONLY the corrected prql_source.

### Component: "${component_title}"

### Failed PRQL
\`\`\`prql
${failed_prql}
\`\`\`

### PRQL Compilation Error
${compile_error}`;
}

/** Builds the user message for a component fix retry when the compiled SQL
 *  fails validation against the actual database schema. The PRQL compiled
 *  successfully, but the resulting SQL references columns, tables, or types
 *  that don't exist in the database. */
export function build_fix_validation_message(
  original_user_message: string,
  component_title: string,
  failed_prql: string,
  validation_error: string,
  attempt: number,
): string {
  return `${original_user_message}

## Fix Required — Attempt ${attempt} of 3

The following component's PRQL compiled to SQL successfully, but the SQL failed validation against the actual database schema. This means the query references columns, tables, types, or operations that don't match the real database. Review the schema provided in the system prompt and fix the prql_source to only use tables and columns that exist. Return ONLY the corrected prql_source.

### Component: "${component_title}"

### Failed PRQL
\`\`\`prql
${failed_prql}
\`\`\`

### Database Validation Error
${validation_error}`;
}

/** Builds the user message for /update-component. Distinguishes create vs edit mode
 *  so the LLM knows whether to start fresh or modify an existing component. */
export function build_component_user_message(
  request: component_request,
): string {
  const parts: string[] = [];

  if (request.component) {
    parts.push(`## Edit Existing Component`);
    parts.push(
      `Modify the component below based on the user's instruction. Preserve any aspects not mentioned in the instruction.`,
    );
    parts.push(`\n### Current Component`);
    parts.push(`Title: ${request.component.title}`);
    parts.push(`Description: ${request.component.description}`);
    parts.push(`Display: ${JSON.stringify(request.component.display)}`);
    parts.push(`Position: ${JSON.stringify(request.component.position)}`);
    parts.push(`\`\`\`prql\n${request.component.prql_source}\n\`\`\``);
  } else {
    parts.push(`## Create New Component`);
    parts.push(
      `Generate a single new dashboard component from scratch based on the request below.`,
    );
  }

  parts.push(`\n## Request\n${request.user_prompt}`);

  return parts.join("\n");
}

export function build_user_message(request: manager_report_request): string {
  const parts: string[] = [];

  if (request.report) {
    parts.push(`## Report: "${request.report.name}"`);
    if (request.report.description) {
      parts.push(`Description: ${request.report.description}`);
    }
    parts.push(
      `Global date range: ${request.report.start_at} to ${request.report.end_at}`,
    );

    if (request.report.components.length > 0) {
      parts.push(`\n## Existing Components (avoid duplicating these)`);
      for (const comp of request.report.components) {
        parts.push(
          `- "${comp.title}" (${comp.display.TAG}) at position (${comp.position.x},${comp.position.y}) size ${comp.position.w}x${comp.position.h}`,
        );
      }
    }
  } else {
    parts.push(`## New Report`);
    parts.push(
      `No existing report — generate components from scratch based on the request below.`,
    );
  }

  parts.push(`\n## Request\n${request.user_prompt}`);

  return parts.join("\n");
}
