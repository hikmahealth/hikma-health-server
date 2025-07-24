import db from "../src/db";
import { createMigrationProviderFromAlembic } from "../src/db/utils";
import kyselyAlembicPairs from "../src/db/alembic-migration-mapping";
import * as fs from "fs/promises";

export async function main() {
  // to enforce a check that the alembic compatible things are
  // present given that we know these are users coming from old DB version
  const importCheck = false;

  const provider = await createMigrationProviderFromAlembic(
    db,
    kyselyAlembicPairs,
    {
      fs: fs,
      migrationFolder: "./src/db/migrations",
      importCheck: importCheck,
    },
  );
}

main();
