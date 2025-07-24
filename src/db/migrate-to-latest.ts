import * as path from "path";
import { promises as fs } from "fs";
import { Migrator, FileMigrationProvider, sql } from "kysely";
import { fileURLToPath } from "url";
import db from "./index";
import { getMigrations } from "./migrations";

// Get the directory path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateToLatest() {
  console.log("Migrating to latest...", __dirname);

  let latestMigrationId = null;
  try {
    const result =
      await sql`SELECT version_num FROM alembic_version LIMIT 1`.execute(db);
    latestMigrationId = result.rows[0]?.version_num;
  } catch (error) {
    // Table doesn't exist, fresh install
    console.log("No alembic_version table found, running all migrations");
  }

  console.log("Latest migration id:", latestMigrationId);
  console.log("Migrations:", getMigrations(latestMigrationId));

  const migrator = new Migrator({
    db,
    allowUnorderedMigrations: false,
    provider: {
      getMigrations: () => Promise.resolve(getMigrations(latestMigrationId)),
    },
    // provider: new FileMigrationProvider({
    //   fs,
    //   path,
    //   migrationFolder: path.join(__dirname, "migrations"),
    // }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

migrateToLatest();
