/**
 * Shared utilities for tRPC RPC procedures.
 * Timestamp coercion, pagination schemas, and SQL helpers.
 */
import { z } from "zod";
import { sql, type RawBuilder } from "kysely";

/**
 * Accepts both ms-epoch (number) and ISO 8601 (string) timestamps.
 * Hub clients send i64 epoch; web/admin clients send ISO strings.
 */
export const flexTimestamp = z.union([z.number(), z.string()]);

/** Optional variant for partial-update fields */
export const flexTimestampOptional = flexTimestamp.nullish();

/** Standard pagination input shared across list/search queries */
export const paginationInput = z.object({
  limit: z.number().int().positive().max(200).optional(),
  offset: z.number().int().nonnegative().optional(),
});

/** Convert a flex timestamp value to a Kysely SQL expression */
export function toSqlTimestamp(
  value: number | string,
): RawBuilder<unknown> {
  if (typeof value === "number") {
    return sql`to_timestamp(${value} / 1000.0)`;
  }
  return sql`${value}::timestamp with time zone`;
}

/** Convert a flex timestamp to a JS Date for use in Kysely where clauses */
export function toDate(value: number | string): Date {
  if (typeof value === "number") return new Date(value);
  return new Date(value);
}

/**
 * Build the standard paginated response envelope used by hub-compatible queries.
 * { data, total, limit, offset }
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number,
) {
  return { data, total, limit, offset };
}
