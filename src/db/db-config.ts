// Add SSL configuration based on environment
export const getDatabaseSSLConfig = () => {
  // If we're using DATABASE_URL (production/staging), enable SSL
  // if (process.env.DATABASE_URL) {
  //   return true;
  // }

  // For local development, check if SSL is explicitly enabled
  const sslEnabled =
    process.env.DB_SSL === "true" || process.env.DB_SSL === "1";
  return sslEnabled;
};

// Extract database configuration from environment variables
export const getDatabaseConfig = (): Record<string, any> => {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseUrlAzure = process.env.AZURE_POSTGRESQL_CONNECTIONSTRING;
  let pgHost: string;
  let pgPort: string = process.env.DB_PORT || "5432";
  let pgDb: string;
  let pgUser: string;
  let pgPassword: string;

  if (databaseUrl) {
    // Extract connection details from DATABASE_URL
    const [dbProto, connectionParams] = databaseUrl.split("//");

    if (dbProto !== "postgresql:") {
      throw new Error(
        "Using a non postgresql database. HH only supports PostgreSQL."
      );
    }

    const [credentials, url] = connectionParams.split("@");
    const values = url.split("/")[0].split(":");

    pgHost = values[0];
    pgPort = values.length > 1 ? values[1] : "5432";
    pgDb = url.split("/")[1];
    pgUser = credentials.split(":")[0];
    pgPassword = credentials.split(":")[1];
  } else if (databaseUrlAzure) {
    // Extract connection details from Azure connection string
    const connStrParams = Object.fromEntries(
      databaseUrlAzure.split(" ").map((pair) => {
        const [key, value] = pair.split("=");
        return [key, value];
      })
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
        "Missing database configuration. Please set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD environment variables."
      );
    }
  }

  return {
    host: pgHost,
    port: parseInt(pgPort, 10),
    database: pgDb,
    user: pgUser,
    password: pgPassword,
    ssl: !getDatabaseSSLConfig()
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  };
};
