import { PGlite } from "@electric-sql/pglite";
import type { table_schema } from "./types.js";

export type validate_result = { ok: true } | { ok: false; error: string };

export type pg_validator = {
  validate: (sql: string) => Promise<validate_result>;
  close: () => Promise<void>;
};

// ── DDL generation ───────────────────────────────────────────

function column_to_ddl(col: table_schema["columns"][number]): string {
  const pg_type = col.dataType || "text";
  const nullable = col.isNullable ? "" : " NOT NULL";
  return `"${col.name}" ${pg_type}${nullable}`;
}

function table_to_ddl(table: table_schema): string[] {
  const qualified = `"${table.schema}"."${table.name}"`;
  const col_defs = table.columns.map(column_to_ddl).join(",\n  ");

  if (table.isView) {
    const base = `"${table.schema}"."_base_${table.name}"`;
    return [
      `CREATE TABLE ${base} (\n  ${col_defs}\n);`,
      `CREATE VIEW ${qualified} AS SELECT * FROM ${base};`,
    ];
  }

  return [`CREATE TABLE ${qualified} (\n  ${col_defs}\n);`];
}

export function schema_to_ddl(tables: table_schema[]): string[] {
  const schemas = [...new Set(tables.map((t) => t.schema))];
  const schema_stmts = schemas
    .filter((s) => s !== "public")
    .map((s) => `CREATE SCHEMA IF NOT EXISTS "${s}";`);

  const table_stmts = tables.flatMap(table_to_ddl);
  return [...schema_stmts, ...table_stmts];
}

// ── Validation ───────────────────────────────────────────────

function format_pg_error(e: unknown): string {
  const err = e as Record<string, unknown>;
  const parts: string[] = [
    `PostgreSQL validation error: ${err.message ?? String(e)}`,
  ];
  if (err.detail) parts.push(`Detail: ${err.detail}`);
  if (err.hint) parts.push(`Hint: ${err.hint}`);
  return parts.join("\n");
}

function max_param_index(sql: string): number {
  const matches = [...sql.matchAll(/\$(\d+)/g)];
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((m) => parseInt(m[1])));
}

async function validate(db: PGlite, sql: string): Promise<validate_result> {
  try {
    const param_count = max_param_index(sql);

    if (param_count > 0) {
      // Use timestamptz — the proxy's $1/$2 are always date range bounds,
      // and text won't coerce for timestamp comparisons in EXPLAIN.
      const type_list = Array(param_count).fill("timestamptz").join(", ");
      const dummy_args = Array(param_count)
        .fill("'2000-01-01T00:00:00Z'")
        .join(", ");
      await db.exec(`PREPARE _validate_stmt (${type_list}) AS ${sql}`);
      await db.exec(`EXPLAIN EXECUTE _validate_stmt(${dummy_args})`);
      await db.exec(`DEALLOCATE _validate_stmt`);
    } else {
      await db.exec(`EXPLAIN ${sql}`);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: format_pg_error(e) };
  }
}

// ── Public API ───────────────────────────────────────────────

export async function create_validator(
  tables: table_schema[],
): Promise<pg_validator> {
  const db = new PGlite();
  const stmts = schema_to_ddl(tables);

  for (const stmt of stmts) {
    try {
      await db.exec(stmt);
    } catch (e) {
      // Unrecognized type — retry with all columns as text
      console.warn(`DDL warning: ${stmt}\n${e}`);
      // Only replace column type definitions (indented lines starting with ")
      // not the CREATE TABLE line itself
      const fallback = stmt.replace(
        /^(  "[^"]+") \S+( NOT NULL)?/gm,
        (_, name, nullable) => `${name} text${nullable ?? ""}`,
      );
      try {
        await db.exec(fallback);
      } catch (e2) {
        console.warn(`DDL fallback also failed: ${fallback}\n${e2}`);
      }
    }
  }

  return {
    validate: (sql) => validate(db, sql),
    close: () => db.close(),
  };
}
