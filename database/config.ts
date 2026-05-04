type SslMode = "disable" | "require" | "verify-ca" | "verify-full";

const VALID_SSL_MODES: readonly SslMode[] = [
  "disable",
  "require",
  "verify-ca",
  "verify-full",
];

const isLoopbackHost = (host: string): boolean =>
  host === "localhost" || host === "127.0.0.1" || host === "::1";

// A bare hostname (no dots) signals a private-network address: Render internal
// DB (e.g. dpg-xxxxxx-a), Kubernetes service name, Docker compose service.
const isPrivateNetworkHost = (host: string): boolean =>
  !host.includes(".") && !isLoopbackHost(host);

// Decide which sslmode applies. Explicit wins; otherwise pick a safe default:
// "disable" for loopback, "require" for non-prod, and "require" + a deprecation
// warning for any production host that hasn't opted in yet (the warning path
// is removed in the next major release, after which prod with no explicit
// sslmode will fail-closed).
const resolveSslMode = (input: {
  explicitMode: string | undefined;
  host: string;
  isProduction: boolean;
}): { mode: SslMode; warning?: string } => {
  const { explicitMode, host, isProduction } = input;

  if (explicitMode) {
    if (!VALID_SSL_MODES.includes(explicitMode as SslMode)) {
      throw new Error(
        `Invalid sslmode "${explicitMode}". Use one of: ${VALID_SSL_MODES.join(", ")}.`,
      );
    }
    return { mode: explicitMode as SslMode };
  }

  if (isLoopbackHost(host)) {
    return { mode: "disable" };
  }

  if (!isProduction) {
    return { mode: "require" };
  }

  if (isPrivateNetworkHost(host)) {
    return {
      mode: "require",
      warning:
        `[hikma-health-server] DEPRECATION: database host "${host}" looks like a ` +
        `private-network address (Render internal DB or similar) and no sslmode was set. ` +
        `Falling back to "require" (encrypt only, no certificate verification) for now. ` +
        `This fallback will be removed in the next major release — set sslmode explicitly ` +
        `by appending "?sslmode=require" or "?sslmode=verify-full" (with DATABASE_CA_CERT) ` +
        `to DATABASE_URL, or by setting the DB_SSLMODE env var.`,
    };
  }

  return {
    mode: "require",
    warning:
      `[hikma-health-server] DEPRECATION: connecting to "${host}" in production without ` +
      `an explicit sslmode. Falling back to "require" (encrypt only, no certificate ` +
      `verification) for now. HIPAA §164.312(e)(1) requires verified TLS, so this ` +
      `fallback will be removed in the next major release and boot will fail. Fix now by ` +
      `appending "?sslmode=verify-full" to DATABASE_URL (recommended; set DATABASE_CA_CERT ` +
      `to the CA PEM if your provider's chain isn't in the system trust store), or by ` +
      `setting DB_SSLMODE.`,
  };
};

const buildSslOption = (
  mode: SslMode,
  caPem: string | undefined,
): false | { rejectUnauthorized: boolean; ca?: string } => {
  if (mode === "disable") return false;
  if (mode === "require") return { rejectUnauthorized: false };
  return caPem
    ? { rejectUnauthorized: true, ca: caPem }
    : { rejectUnauthorized: true };
};

// Extract database configuration from environment variables.
//
// Precedence (URL form is preferred over individual DB_* vars):
//   1. TEST_DATABASE_URL — honored only when NODE_ENV === "test" so a stray
//      test URL in a dev/prod shell can't accidentally redirect the app.
//   2. DATABASE_URL
//   3. AZURE_POSTGRESQL_CONNECTIONSTRING
//   4. DB_HOST / DB_NAME / DB_USER / DB_PASSWORD (last-resort fallback)
export const getDatabaseConfig = (): Record<string, any> => {
  const isTestEnv = process.env.NODE_ENV === "test";
  const databaseUrl =
    (isTestEnv && process.env.TEST_DATABASE_URL) || process.env.DATABASE_URL;
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

    if (!pgHost || !pgDb || !pgUser || !pgPassword) {
      throw new Error(
        "Incomplete AZURE_POSTGRESQL_CONNECTIONSTRING: needs host, dbname, user, and password.",
      );
    }
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

  if (process.env.DATABASE_SSL_OPTIONS) {
    console.warn(
      `[hikma-health-server] DATABASE_SSL_OPTIONS is no longer supported and is being ignored. ` +
        `Set sslmode in DATABASE_URL (or via DB_SSLMODE) and provide DATABASE_CA_CERT for a custom CA bundle.`,
    );
  }

  let urlSslmode: string | undefined;
  if (opts.sslmode !== undefined && opts.sslmode !== null) {
    urlSslmode = String(opts.sslmode);
    delete opts.sslmode;
  }

  const { mode: sslMode, warning: sslWarning } = resolveSslMode({
    explicitMode: urlSslmode ?? process.env.DB_SSLMODE,
    host: pgHost,
    isProduction: process.env.NODE_ENV === "production",
  });
  if (sslWarning) console.warn(sslWarning);
  // Normalize literal "\n" sequences in PEM bodies (a common mistake when
  // passing certs via shell exports) so node-tls can parse the chain.
  const caPem = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  opts.ssl = buildSslOption(sslMode, caPem);

  if (migration_mode) {
    // FIXME: @kev this breaks my builds with a TLS/SSL error
    // opts.ssl = false;
  }

  const out = {
    ...opts,
    host: pgHost,
    port: parseInt(pgPort, 10),
    database: pgDb,
    user: pgUser,
    password: pgPassword,
  };

  return out;
};
