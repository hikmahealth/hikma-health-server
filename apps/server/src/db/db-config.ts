// // Add SSL configuration based on environment
// export const getDatabaseSSLConfig = () => {
//   const sslEnabled =
//     process.env.DB_SSL === "true" || process.env.DB_SSL === "1";
//   return sslEnabled;
// };

// // Extract database configuration from environment variables
// export const getDatabaseConfig = (): Record<string, any> => {
//   const databaseUrl = process.env.DATABASE_URL;
//   const databaseUrlAzure = process.env.AZURE_POSTGRESQL_CONNECTIONSTRING;
//   let pgHost: string;
//   let pgPort: string = process.env.DB_PORT || "5432";
//   let pgDb: string;
//   let pgUser: string;
//   let pgPassword: string;

//   if (databaseUrl) {
//     // Use the URL API for safe parsing — handles passwords with @, :, etc.
//     const parsed = new URL(databaseUrl);

//     if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
//       throw new Error(
//         "Using a non postgresql database. HH only supports PostgreSQL.",
//       );
//     }

//     pgHost = parsed.hostname;
//     pgPort = parsed.port || "5432";
//     pgDb = parsed.pathname.slice(1); // remove leading "/"
//     pgUser = decodeURIComponent(parsed.username);
//     pgPassword = decodeURIComponent(parsed.password);
//   } else if (databaseUrlAzure) {
//     // Extract connection details from Azure connection string
//     // Split on first "=" only so values containing "=" (e.g., passwords) aren't truncated
//     const connStrParams = Object.fromEntries(
//       databaseUrlAzure.split(" ").map((pair) => {
//         const idx = pair.indexOf("=");
//         return [pair.slice(0, idx), pair.slice(idx + 1)];
//       }),
//     );

//     pgUser = connStrParams.user;
//     pgPassword = connStrParams.password;
//     pgHost = connStrParams.host;
//     pgDb = connStrParams.dbname;
//   } else {
//     // Use individual environment variables
//     pgHost = process.env.DB_HOST || "localhost";
//     pgDb = process.env.DB_NAME || "hikma_dev";
//     pgUser = process.env.DB_USER || "postgres";
//     pgPassword = process.env.DB_PASSWORD || "postgres";
//   }

//   const sslEnabled = getDatabaseSSLConfig();

//   return {
//     host: pgHost,
//     port: parseInt(pgPort, 10),
//     database: pgDb,
//     user: pgUser,
//     password: pgPassword,
//     // Only enable SSL when DB_SSL is explicitly set.
//     // Set DB_SSL_REJECT_UNAUTHORIZED=true in environments with
//     // properly signed certificates (e.g., AWS RDS, Azure).
//     // Render.com and similar providers use self-signed certificates,
//     // so rejectUnauthorized defaults to false when SSL is enabled.
//     ssl: sslEnabled
//       ? {
//           rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
//         }
//       : undefined,
//   };
// };
