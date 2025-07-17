import { defineConfig } from "kysely-ctl";
import { Pool } from "pg";

export default defineConfig({
  destroyOnExit: true, // optional. dictates whether the (resolved) `kysely` instance should be destroyed when a command is finished executing. default is `true`.
  dialect: "pg", // a `Kysely` dialect instance OR the name of an underlying driver library (e.g. `'pg'`).
  dialectConfig: {
    pool: new Pool({
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      max: 10,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: {
        rejectUnauthorized: false,
      },
    }),
  }, // optional. when `dialect` is the name of an underlying driver library, `dialectConfig` is the options passed to the Kysely dialect that matches that library.
  migrations: {
    // optional.
    allowJS: false, // optional. controls whether `.js`, `.cjs` or `.mjs` migrations are allowed. default is `false`.
    // getMigrationPrefix, // optional. a function that returns a migration prefix. affects `migrate make` command. default is `() => ${Date.now()}_`.
    migrationFolder: "src/db/migrations", // optional. name of migrations folder. default is `'migrations'`.
    // migrator, // optional. a `Kysely` migrator instance factory of shape `(db: Kysely<any>) => Migrator | Promise<Migrator>`. default is `Kysely`'s `Migrator`.
    // provider, // optional. a `Kysely` migration provider instance. default is `kysely-ctl`'s `TSFileMigrationProvider`.
  },
  plugins: [], // optional. `Kysely` plugins list. default is `[]`.
  seeds: {
    // optional.
    // allowJS, // optional. controls whether `.js`, `.cjs` or `.mjs` seeds are allowed. default is `false`.
    // getSeedPrefix, // optional. a function that returns a seed prefix. affects `seed make` command. default is `() => ${Date.now()}_`.
    // provider, // optional. a seed provider instance. default is `kysely-ctl`'s `FileSeedProvider`.
    // seeder, // optional. a seeder instance factory of shape `(db: Kysely<any>) => Seeder | Promise<Seeder>`. default is `kysely-ctl`'s `Seeder`.
    // seedFolder, // optional. name of seeds folder. default is `'seeds'`.
  },
});
