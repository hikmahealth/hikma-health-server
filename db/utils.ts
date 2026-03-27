import type { Kysely, Migration, MigrationProvider } from "kysely";
import { sql } from "kysely";
import type { Database } from "../src/db";
import {
  TSFileMigrationProvider,
  type TSFileMigrationProviderProps,
} from "kysely-ctl";
import type { Client, Pool } from "pg";

/**
 * Creates the `FileMigrationProvider` instance, that is able to
 * filter out the keys keys from the sequence head
 * @param alembicHeadId
 * @abstract
 */
export async function createMigrationProviderFromAlembic(
  db: Kysely<Database>,
  kyselyAlembicPairs: Array<[string, string]>,
  props: TSFileMigrationProviderProps & {
    /**
     * When this flag is set, we assume they want to check if the databasae is being
     * created from a pre-existing instance with alembic. This is for when you are sure
     * you are doing an import.
     */
    importCheck?: boolean;
  },
) {
  // get the migration head from the `alembic_version` table
  let alembicMigrationHead = null;
  try {
    const result =
      await sql`SELECT version_num FROM alembic_version LIMIT 1`.execute(db);
    // @ts-expect-error Property version_num does not exist on type {}
    alembicMigrationHead = result.rows[0]?.version_num;
  } catch (error) {
    if (props.importCheck) {
      throw new Error(
        "No alembic_version table found. If you are coming from an imported database, contact the HikmaHealth Administrator to help with this ",
      );
    } else {
      // Table doesn't exist, fresh install
      console.log(
        "No alembic_version table found. Likely a new install running all migrations",
      );
    }
  }

  // get the list of kysely migration corresponding
  const ignoreList: string[] = [];
  if (alembicMigrationHead) {
    const latestindex = kyselyAlembicPairs.findIndex(
      ([, alembicId]) => alembicId === alembicMigrationHead,
    );

    if (latestindex !== -1) {
      ignoreList.push(
        ...kyselyAlembicPairs.slice(0, latestindex + 1).map(([id]) => id),
      );
    } else {
      // This shouldn't happen.
      // It either means that someone touched the `alembic-migrations-mapping.tsx?` file
      // OR someone messed with the alembic_version table
      throw new Error(
        `Found the alembic migration head '${alembicMigrationHead}', but did not find the corresponding kysely file.`,
      );
    }
  }

  return new (class FilterHeadAlembicMigrationProvider implements MigrationProvider {
    #ignorelist: string[];
    #provider;
    constructor(ignorelist: string[], props: TSFileMigrationProviderProps) {
      this.#ignorelist = ignorelist;
      this.#provider = new TSFileMigrationProvider(props);
    }

    async getMigrations(): Promise<Record<string, Migration>> {
      const migrations = await this.#provider
        .getMigrations()
        .then((migrations) => {
          return Object.fromEntries(
            Object.entries(migrations).filter(
              ([id]) => !this.#ignorelist.includes(id),
            ),
          );
        });

      // migrations to use
      console.log({ migrations });
      return migrations;
    }
  })(ignoreList, props);
}

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
