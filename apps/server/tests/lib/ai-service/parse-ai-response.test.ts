import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  parseDisplayType,
  parseAIReportComponent,
  parseAIResponse,
} from "../../../src/lib/ai-service/reports-editor";

// ── Arbitraries ────────────────────────────────────────────

const arbPosition = fc.record({
  x: fc.integer({ min: 0, max: 11 }),
  y: fc.integer({ min: 0, max: 20 }),
  w: fc.integer({ min: 1, max: 12 }),
  h: fc.integer({ min: 1, max: 8 }),
});

const arbStatCardDisplay = fc.record({
  type: fc.constant("stat_card"),
  config: fc.record({
    value_field: fc.string({ minLength: 1 }),
    label: fc.string({ minLength: 1 }),
    format: fc.oneof(
      fc.constant("number"),
      fc.constant("currency"),
      fc.constant("percent"),
    ),
  }),
});

const arbLineChartDisplay = fc.record({
  type: fc.constant("line_chart"),
  config: fc.record({
    x_axis: fc.string({ minLength: 1 }),
    y_axis: fc.string({ minLength: 1 }),
  }),
});

const arbPieChartDisplay = fc.record({
  type: fc.constant("pie_chart"),
  config: fc.record({
    label_field: fc.string({ minLength: 1 }),
    value_field: fc.string({ minLength: 1 }),
  }),
});

const arbBarChartDisplay = fc.record({
  type: fc.constant("bar_chart"),
  config: fc.record({
    x_axis: fc.string({ minLength: 1 }),
    y_axis: fc.string({ minLength: 1 }),
    orientation: fc.oneof(fc.constant("horizontal"), fc.constant("vertical")),
    stacked: fc.boolean(),
  }),
});

const arbTableColumn = fc.record({
  key: fc.string({ minLength: 1 }),
  label: fc.string({ minLength: 1 }),
  format: fc.oneof(
    fc.constant("number"),
    fc.constant("date"),
    fc.constant("currency"),
    fc.constant("percent"),
  ),
  sortable: fc.boolean(),
});

const arbTableDisplay = fc.record({
  type: fc.constant("table"),
  config: fc.record({
    columns: fc.array(arbTableColumn, { minLength: 1, maxLength: 5 }),
  }),
});

const arbAnyDisplay = fc.oneof(
  arbStatCardDisplay,
  arbLineChartDisplay,
  arbPieChartDisplay,
  arbBarChartDisplay,
  arbTableDisplay,
);

const arbAIComponent = (display = arbAnyDisplay) =>
  fc.record({
    title: fc.string({ minLength: 1 }),
    description: fc.string({ minLength: 1 }),
    prql_source: fc.string({ minLength: 1 }),
    compiled_sql: fc.string({ minLength: 1 }),
    compile_error: fc.constant(null),
    display,
    position: arbPosition,
  });

// ── Tests ──────────────────────────────────────────────────

describe("parseDisplayType", () => {
  it("maps stat_card to StatCard TAG", () => {
    fc.assert(
      fc.property(arbStatCardDisplay, (display) => {
        const result = parseDisplayType(display);
        expect(result).not.toBeNull();
        expect(result!.TAG).toBe("StatCard");
        expect(result!._0).toHaveProperty(
          "valueField",
          display.config.value_field,
        );
        expect(result!._0).toHaveProperty("label", display.config.label);
      }),
      { numRuns: 20 },
    );
  });

  it("maps line_chart to LineChart TAG", () => {
    fc.assert(
      fc.property(arbLineChartDisplay, (display) => {
        const result = parseDisplayType(display);
        expect(result).not.toBeNull();
        expect(result!.TAG).toBe("LineChart");
        expect(result!._0).toHaveProperty("xAxis", display.config.x_axis);
        expect(result!._0).toHaveProperty("yAxis", display.config.y_axis);
      }),
      { numRuns: 20 },
    );
  });

  it("maps pie_chart to PieChart TAG", () => {
    fc.assert(
      fc.property(arbPieChartDisplay, (display) => {
        const result = parseDisplayType(display);
        expect(result).not.toBeNull();
        expect(result!.TAG).toBe("PieChart");
        expect(result!._0).toHaveProperty(
          "labelField",
          display.config.label_field,
        );
        expect(result!._0).toHaveProperty(
          "valueField",
          display.config.value_field,
        );
      }),
      { numRuns: 20 },
    );
  });

  it("maps bar_chart to BarChart TAG", () => {
    fc.assert(
      fc.property(arbBarChartDisplay, (display) => {
        const result = parseDisplayType(display);
        expect(result).not.toBeNull();
        expect(result!.TAG).toBe("BarChart");
        expect(result!._0).toHaveProperty("xAxis", display.config.x_axis);
        expect(result!._0).toHaveProperty("yAxis", display.config.y_axis);
      }),
      { numRuns: 20 },
    );
  });

  it("maps table to Table TAG with columns", () => {
    fc.assert(
      fc.property(arbTableDisplay, (display) => {
        const result = parseDisplayType(display);
        expect(result).not.toBeNull();
        expect(result!.TAG).toBe("Table");
        const tableConfig = result!._0 as { columns: any[] };
        expect(tableConfig.columns).toHaveLength(
          (display.config.columns as any[]).length,
        );
      }),
      { numRuns: 20 },
    );
  });

  it("returns null for unknown display types", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !["stat_card", "line_chart", "pie_chart", "bar_chart", "table"].includes(s)),
        (type) => {
          const result = parseDisplayType({ type, config: {} });
          expect(result).toBeNull();
        },
      ),
      { numRuns: 20 },
    );
  });
});

describe("parseAIReportComponent", () => {
  it("skips components with compile errors", () => {
    fc.assert(
      fc.property(
        arbAIComponent(),
        fc.string({ minLength: 1 }),
        (comp, reportId) => {
          const withError = { ...comp, compile_error: "some error" };
          expect(parseAIReportComponent(withError, reportId)).toBeNull();
        },
      ),
      { numRuns: 10 },
    );
  });

  it("produces valid reportComponent for valid input", () => {
    fc.assert(
      fc.property(arbAIComponent(), (comp) => {
        const result = parseAIReportComponent(comp, "test-report-id");
        expect(result).not.toBeNull();
        expect(result!.reportId).toBe("test-report-id");
        expect(result!.title).toBe(comp.title);
        expect(result!.prqlSource).toBe(comp.prql_source);
        expect(result!.compiledSql).toBe(comp.compiled_sql);
        expect(result!.position).toEqual(comp.position);
      }),
      { numRuns: 20 },
    );
  });
});

describe("parseAIResponse", () => {
  it("filters out components with errors and unknown types", () => {
    fc.assert(
      fc.property(
        fc.array(arbAIComponent(), { minLength: 1, maxLength: 5 }),
        (components) => {
          // Add one bad component
          const withBad = [
            ...components,
            {
              ...components[0],
              compile_error: "bad sql",
            },
            {
              ...components[0],
              compile_error: null,
              display: { type: "unknown_type", config: {} },
            },
          ];
          const result = parseAIResponse(withBad, "report-1");
          // Should have exactly the valid components count (excludes the 2 bad ones)
          expect(result.length).toBe(components.length);
        },
      ),
      { numRuns: 10 },
    );
  });
});
