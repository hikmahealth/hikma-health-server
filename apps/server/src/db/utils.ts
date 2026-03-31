import type { Client, Pool } from "pg";

/**
 * Validates a SQL statement against a live PostgreSQL database
 * without executing it. Uses PREPARE/DEALLOCATE to check syntax,
 * table/column existence, and type compatibility.
 *
 * @param client - A pg Pool or Client instance with an active connection
 * @param sql - The SQL statement to validate
 * @returns An object indicating validity, with an error message if invalid
 *
 * @example
 * const result = await validateSQL(pool, 'SELECT * FROM users WHERE id = 1');
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 */
export async function validateSQL(
  client: Pool | Client,
  sql: string,
): Promise<{ valid: boolean; error?: string }> {
  const name = `validate_${Date.now()}`;
  try {
    await client.query(`PREPARE ${name} AS ${sql}`);
    await client.query(`DEALLOCATE ${name}`);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}
