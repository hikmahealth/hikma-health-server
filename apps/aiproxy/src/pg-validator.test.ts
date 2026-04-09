import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import {
  create_validator,
  schema_to_ddl,
  type pg_validator,
} from "./pg-validator.js";
import type { table_schema } from "./types.js";

// ── Helpers ──────────────────────────────────────────────────

function make_table(
  name: string,
  columns: { name: string; dataType: string; isNullable?: boolean }[],
  opts?: { schema?: string; isView?: boolean },
): table_schema {
  return {
    name,
    isView: opts?.isView ?? false,
    schema: opts?.schema ?? "public",
    columns: columns.map((c) => ({
      name: c.name,
      dataType: c.dataType,
      dataTypeSchema: "pg_catalog",
      isNullable: c.isNullable ?? true,
      isAutoIncrementing: false,
      hasDefaultValue: false,
    })),
  };
}

const patients_table = make_table("patients", [
  { name: "id", dataType: "uuid", isNullable: false },
  { name: "given_name", dataType: "text" },
  { name: "family_name", dataType: "text" },
  { name: "created_at", dataType: "timestamp", isNullable: false },
  { name: "age", dataType: "integer" },
]);

const events_table = make_table("events", [
  { name: "id", dataType: "uuid", isNullable: false },
  { name: "patient_id", dataType: "uuid", isNullable: false },
  { name: "form_id", dataType: "uuid", isNullable: false },
  { name: "form_data", dataType: "jsonb" },
  { name: "created_at", dataType: "timestamp", isNullable: false },
]);

// ── DDL generation tests ─────────────────────────────────────

describe("schema_to_ddl", () => {
  it("generates CREATE TABLE for a simple table", () => {
    const ddl = schema_to_ddl([
      make_table("users", [
        { name: "id", dataType: "uuid", isNullable: false },
      ]),
    ]);
    expect(ddl).toHaveLength(1);
    expect(ddl[0]).toContain('CREATE TABLE "public"."users"');
    expect(ddl[0]).toContain('"id" uuid NOT NULL');
  });

  it("generates CREATE SCHEMA for non-public schemas", () => {
    const ddl = schema_to_ddl([
      make_table("logs", [{ name: "id", dataType: "integer" }], {
        schema: "audit",
      }),
    ]);
    expect(ddl[0]).toBe('CREATE SCHEMA IF NOT EXISTS "audit";');
    expect(ddl[1]).toContain('CREATE TABLE "audit"."logs"');
  });

  it("generates backing table + view for isView: true", () => {
    const ddl = schema_to_ddl([
      make_table("active_patients", [{ name: "id", dataType: "uuid" }], {
        isView: true,
      }),
    ]);
    expect(ddl).toHaveLength(2);
    expect(ddl[0]).toContain("_base_active_patients");
    expect(ddl[1]).toContain("CREATE VIEW");
    expect(ddl[1]).toContain('"public"."active_patients"');
  });

  it("marks nullable vs not-null columns correctly", () => {
    const ddl = schema_to_ddl([
      make_table("t", [
        { name: "a", dataType: "text", isNullable: true },
        { name: "b", dataType: "text", isNullable: false },
      ]),
    ]);
    expect(ddl[0]).toContain('"a" text');
    expect(ddl[0]).not.toContain('"a" text NOT NULL');
    expect(ddl[0]).toContain('"b" text NOT NULL');
  });
});

// ── Validation tests ─────────────────────────────────────────

describe("create_validator + validate", () => {
  let validator: pg_validator;

  afterEach(async () => {
    if (validator) await validator.close();
  });

  it("accepts a valid SELECT", async () => {
    validator = await create_validator([patients_table]);
    const result = await validator.validate(
      'SELECT "given_name", "family_name" FROM "public"."patients"',
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a hallucinated column", async () => {
    validator = await create_validator([patients_table]);
    const result = await validator.validate(
      'SELECT "nonexistent_col" FROM "public"."patients"',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("nonexistent_col");
    }
  });

  it("rejects a hallucinated table", async () => {
    validator = await create_validator([patients_table]);
    const result = await validator.validate(
      'SELECT * FROM "public"."no_such_table"',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("no_such_table");
    }
  });

  it("rejects a type mismatch (SUM on text)", async () => {
    validator = await create_validator([patients_table]);
    const result = await validator.validate(
      'SELECT SUM("given_name") FROM "public"."patients"',
    );
    expect(result.ok).toBe(false);
  });

  it("validates a JOIN between tables", async () => {
    validator = await create_validator([patients_table, events_table]);
    const result = await validator.validate(
      'SELECT p."given_name", e."form_data" FROM "public"."patients" p JOIN "public"."events" e ON p."id" = e."patient_id"',
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a JOIN on a non-existent column", async () => {
    validator = await create_validator([patients_table, events_table]);
    const result = await validator.validate(
      'SELECT * FROM "public"."patients" p JOIN "public"."events" e ON p."id" = e."fake_col"',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("fake_col");
    }
  });

  it("validates parameterized queries ($1, $2)", async () => {
    validator = await create_validator([patients_table]);
    const result = await validator.validate(
      'SELECT "given_name" FROM "public"."patients" WHERE "created_at" >= $1 AND "created_at" <= $2',
    );
    expect(result).toEqual({ ok: true });
  });

  it("validates queries against views", async () => {
    const view = make_table(
      "active_patients",
      [
        { name: "id", dataType: "uuid" },
        { name: "given_name", dataType: "text" },
      ],
      { isView: true },
    );
    validator = await create_validator([view]);
    const result = await validator.validate(
      'SELECT "given_name" FROM "public"."active_patients"',
    );
    expect(result).toEqual({ ok: true });
  });

  it("handles reserved-word column names", async () => {
    const table = make_table("t", [
      { name: "order", dataType: "integer" },
      { name: "select", dataType: "text" },
    ]);
    validator = await create_validator([table]);
    const result = await validator.validate(
      'SELECT "order", "select" FROM "public"."t"',
    );
    expect(result).toEqual({ ok: true });
  });

  it("handles jsonb columns", async () => {
    validator = await create_validator([events_table]);
    const result = await validator.validate(
      `SELECT "form_data"->>'name' AS name FROM "public"."events"`,
    );
    expect(result).toEqual({ ok: true });
  });

  it("falls back to text when dataType is missing", async () => {
    const table: table_schema = {
      name: "clinics",
      isView: false,
      schema: "public",
      columns: [
        {
          name: "name",
          dataType: undefined as unknown as string,
          dataTypeSchema: "pg_catalog",
          isNullable: true,
          isAutoIncrementing: false,
          hasDefaultValue: false,
        },
      ],
    };
    validator = await create_validator([table]);
    const result = await validator.validate(
      'SELECT "name" FROM "public"."clinics"',
    );
    expect(result).toEqual({ ok: true });
  });

  it("validates aggregate queries", async () => {
    validator = await create_validator([patients_table]);
    const result = await validator.validate(
      'SELECT COUNT(*) AS total, AVG("age") AS avg_age FROM "public"."patients"',
    );
    expect(result).toEqual({ ok: true });
  });
});

// ── Property-based tests ─────────────────────────────────────

const pg_types = [
  "text",
  "integer",
  "bigint",
  "boolean",
  "uuid",
  "timestamp",
  "date",
  "jsonb",
  "numeric",
  "real",
];

const identifier_arb = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,19}$/)
  .filter((s) => s.length >= 2);

const column_arb = fc.record({
  name: identifier_arb,
  dataType: fc.constantFrom(...pg_types),
  dataTypeSchema: fc.constant("pg_catalog"),
  isNullable: fc.boolean(),
  isAutoIncrementing: fc.constant(false),
  hasDefaultValue: fc.constant(false),
});

const table_arb: fc.Arbitrary<table_schema> = fc.record({
  name: identifier_arb,
  isView: fc.constant(false),
  schema: fc.constant("public"),
  columns: fc.array(column_arb, { minLength: 1, maxLength: 8 }),
});

describe("property-based", () => {
  it(
    "any generated schema accepts SELECT * for each table",
    { timeout: 30_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(table_arb, { minLength: 1, maxLength: 4 }),
          async (tables) => {
            const seen = new Set<string>();
            const unique = tables.filter((t) => {
              if (seen.has(t.name)) return false;
              seen.add(t.name);
              const col_seen = new Set<string>();
              t.columns = t.columns.filter((c) => {
                if (col_seen.has(c.name)) return false;
                col_seen.add(c.name);
                return true;
              });
              return t.columns.length > 0;
            });
            if (unique.length === 0) return;

            const v = await create_validator(unique);
            try {
              for (const t of unique) {
                const result = await v.validate(
                  `SELECT * FROM "${t.schema}"."${t.name}"`,
                );
                expect(result).toEqual({ ok: true });
              }
            } finally {
              await v.close();
            }
          },
        ),
        { numRuns: 20 },
      );
    },
  );

  it(
    "any generated schema rejects SELECT from a non-existent table",
    { timeout: 30_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(table_arb, async (table) => {
          const col_seen = new Set<string>();
          table.columns = table.columns.filter((c) => {
            if (col_seen.has(c.name)) return false;
            col_seen.add(c.name);
            return true;
          });
          if (table.columns.length === 0) return;

          const v = await create_validator([table]);
          try {
            const result = await v.validate(
              'SELECT * FROM "public"."zzz_does_not_exist"',
            );
            expect(result.ok).toBe(false);
          } finally {
            await v.close();
          }
        }),
        { numRuns: 10 },
      );
    },
  );
});
