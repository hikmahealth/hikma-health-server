import "dotenv/config";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "@/db";
import { afterAll } from "vitest";

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!testDbUrl) {
  throw new Error(
    "TEST_DATABASE_URL or DATABASE_URL must be set for integration tests",
  );
}

if (!process.env.TEST_DATABASE_URL) {
  console.warn(
    "⚠ TEST_DATABASE_URL not set — falling back to DATABASE_URL. " +
      "Set TEST_DATABASE_URL to a dedicated test database for safer testing.",
  );
}

export const testDb = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: testDbUrl }),
  }),
});

afterAll(async () => {
  await testDb.destroy();
});
