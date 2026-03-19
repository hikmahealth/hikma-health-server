// Extract database configuration from environment variables
export const getDatabaseConfig = (): Record<string, any> => {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseUrlAzure = process.env.AZURE_POSTGRESQL_CONNECTIONSTRING;
  let pgHost: string;
  let pgPort: string = process.env.DB_PORT || "5432";
  let pgDb: string;
  let pgUser: string;
  let pgPassword: string;
  let opts: Record<string, any> = {};

  // console.log({ databaseUrl });
  if (databaseUrl) {
    const dburl = new URL(databaseUrl);
    // Extract connection details from DATABASE_URL

    if (dburl.protocol !== "postgresql:" && dburl.protocol != "postgres:") {
      throw new Error(
        "Using a non postgresql database. HH only supports PostgreSQL.",
      );
    }

    pgHost = dburl.hostname;
    pgPort = dburl.port ? dburl.port : "5432";
    pgDb = dburl.pathname.replace(/(^\/)/g, "");
    pgUser = dburl.username;
    pgPassword = dburl.password;

    for (let [k, v] of dburl.searchParams.entries()) {
      try {
        opts[k] = JSON.parse(v);
      } catch {
        if (v === "true") {
          opts[k] = true;
        } else if (v === "false") {
          opts[k] = false;
        } else {
          opts[k] = v;
        }
      }
    }
  } else if (databaseUrlAzure) {
    // Extract connection details from Azure connection string
    const connStrParams = Object.fromEntries(
      databaseUrlAzure.split(" ").map((pair) => {
        const [key, value] = pair.split("=");
        return [key, value];
      }),
    );

    pgUser = connStrParams.user;
    pgPassword = connStrParams.password;
    pgHost = connStrParams.host;
    pgDb = connStrParams.dbname;
  } else {
    // Use individual environment variables
    pgHost = process.env.DB_HOST!;
    pgDb = process.env.DB_NAME!;
    pgUser = process.env.DB_USER!;
    pgPassword = process.env.DB_PASSWORD!;

    if (!pgHost || !pgDb || !pgUser || !pgPassword) {
      throw new Error(
        "Missing database configuration. Please set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD environment variables.",
      );
    }
  }

  let migration_mode = false;
  let dbmigration = process.env.DB_MIGRATION;
  if (dbmigration) {
    switch (dbmigration.toString()) {
      case "0":
      case "false": {
        migration_mode = false;
        break;
      }
      case "1":
      case "true": {
        migration_mode = true;
        break;
      }
      default: {
        throw new Error("unknown value in DB_MIGRATION either 0,1,true,false");
      }
    }
  }

  // console.log({ migration_mode, dbmigration });

  return {
    ...opts,
    host: pgHost,
    port: parseInt(pgPort, 10),
    database: pgDb,
    user: pgUser,
    password: pgPassword,
    ssl: migration_mode ? { rejectUnauthorized: false } : opts.ssl,
  };
};
