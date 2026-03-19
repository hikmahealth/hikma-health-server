import type { DB } from "../schema/pg/hh";
import { createMigrationProviderFromAlembic } from "./util";
import { alembicMigrationIds } from "./mapping";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Migrator, type Kysely } from "kysely";

// Following the spec for the migration as required by `defaultConfigProps.migrations.migrator` in
// `kysely.config.ts`.
export async function almebicBackcompatMigrator(db: Kysely<DB>) {
  const provider = await createMigrationProviderFromAlembic(
    db,
    alembicMigrationIds,
    {
      fs: fs,
      migrationFolder: path.join(process.cwd(), "migrations"),
      // importCheck: false,
      path: path,
    },
  );

  return new Migrator({ db, provider, allowUnorderedMigrations: false });
}
