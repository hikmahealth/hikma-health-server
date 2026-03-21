import { Client } from "ldapts";

type LdapConfig = {
  url: string;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  /** Filter template. Use `{email}` as a placeholder for the user's email address. */
  searchFilter: string;
  tlsEnabled: boolean;
};

const getLdapConfig = (): LdapConfig => ({
  url: process.env.LDAP_URL ?? "",
  bindDn: process.env.LDAP_BIND_DN ?? "",
  bindPassword: process.env.LDAP_BIND_PASSWORD ?? "",
  searchBase: process.env.LDAP_SEARCH_BASE ?? "",
  searchFilter: process.env.LDAP_SEARCH_FILTER ?? "(mail={email})",
  tlsEnabled: process.env.LDAP_TLS_ENABLED === "true",
});

/**
 * Authenticate a user against the configured LDAP server.
 *
 * Flow:
 *   1. Bind as the service account (LDAP_BIND_DN / LDAP_BIND_PASSWORD).
 *   2. Search for the user entry by email using LDAP_SEARCH_FILTER.
 *   3. Rebind as the found user DN with the supplied password to verify credentials.
 *
 * Required env vars:
 *   LDAP_URL            - e.g. ldap://ldap.example.com or ldaps://ldap.example.com
 *   LDAP_BIND_DN        - Service account DN for the initial search bind
 *   LDAP_BIND_PASSWORD  - Service account password
 *   LDAP_SEARCH_BASE    - Base DN to search under, e.g. ou=users,dc=example,dc=com
 *
 * Optional env vars:
 *   LDAP_SEARCH_FILTER  - Filter template (default: (mail={email}))
 *   LDAP_TLS_ENABLED    - Set to "true" to enable STARTTLS (default: false)
 *
 * @returns true if credentials are valid, false otherwise
 * @throws Error if LDAP is misconfigured (missing required env vars)
 */
export const authenticateWithLdap = async (
  email: string,
  password: string,
): Promise<boolean> => {
  const config = getLdapConfig();

  if (!config.url) throw new Error("LDAP_URL is not configured");
  if (!config.bindDn) throw new Error("LDAP_BIND_DN is not configured");
  if (!config.searchBase) throw new Error("LDAP_SEARCH_BASE is not configured");

  const client = new Client({
    url: config.url,
    tlsOptions: config.tlsEnabled ? { rejectUnauthorized: true } : undefined,
  });

  try {
    // Step 1: service-account bind to search the directory
    await client.bind(config.bindDn, config.bindPassword);

    const filter = config.searchFilter.replace("{email}", email);
    const { searchEntries } = await client.search(config.searchBase, {
      scope: "sub",
      filter,
      attributes: ["dn"],
    });

    if (searchEntries.length === 0) {
      return false;
    }

    const userDn = searchEntries[0].dn;

    // Step 2: rebind as the user to verify their password
    await client.bind(userDn, password);
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore unbind errors
    }
  }
};
