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
    // Extract connection details from DATABASE_URL using URL parser
    const parsed = new URL(databaseUrl);

    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      throw new Error(
        "Using a non postgresql database. HH only supports PostgreSQL.",
      );
    }

    pgHost = parsed.hostname;
    pgPort = parsed.port || "5432";
    pgDb = parsed.pathname.replace(/^\//, "");
    pgUser = decodeURIComponent(parsed.username);
    pgPassword = decodeURIComponent(parsed.password);
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
    pgHost = process.env.DB_HOST || "localhost";
    pgDb = process.env.DB_NAME || "hikma_dev";
    pgUser = process.env.DB_USER || "postgres";
    pgPassword = process.env.DB_PASSWORD || "postgres";
  }

  return {
    host: pgHost,
    port: parseInt(pgPort, 10),
    database: pgDb,
    user: pgUser,
    password: pgPassword,
    ssl: {
      rejectUnauthorized: false,
    },
  };
};
