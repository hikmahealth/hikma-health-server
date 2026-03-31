import { compile, CompileOptions } from "prqlc";

// Patterns that should never appear in compiled SQL.
// Defense-in-depth: PRQL only generates SELECT, but we verify anyway.
const DANGEROUS_SQL_PATTERNS = [
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE)\b/i,
  /\b(GRANT|REVOKE|COMMIT|ROLLBACK|SAVEPOINT)\b/i,
  /\b(EXEC|EXECUTE|CALL)\b/i,
  /\b(ATTACH|DETACH)\b/i,
  /\b(PRAGMA)\b/i,
  /\b(VACUUM|REINDEX|ANALYZE)\b/i,
  /;\s*\S/, // multiple statements
];

export type compile_result =
  | { ok: true; sql: string }
  | { ok: false; error: string };

export function compile_prql(prql_source: string): compile_result {
  const opts = new CompileOptions();
  opts.target = "sql.postgres";
  opts.signature_comment = false;

  let sql: string | undefined;
  try {
    sql = compile(prql_source, opts);
  } catch (e: any) {
    return { ok: false, error: `PRQL compilation failed: ${e.message ?? e}` };
  }

  if (!sql) {
    return { ok: false, error: "PRQL compilation returned empty result" };
  }

  // Safety check runs inside compilation so callers get a unified error path
  for (const pattern of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      return {
        ok: false,
        error: `Compiled SQL contains disallowed pattern: ${pattern}. \nTimestamp: ${new Date().toISOString()}`,
      };
    }
  }

  return { ok: true, sql };
}
