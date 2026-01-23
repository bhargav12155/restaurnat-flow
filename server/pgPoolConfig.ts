type PgPoolBaseConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: {
    rejectUnauthorized: boolean;
  };
};

export function buildPgPoolConfig(connectionString: string): PgPoolBaseConfig {
  const url = new URL(connectionString);
  const sslMode = (
    url.searchParams.get("sslmode") || process.env.PGSSLMODE || ""
  ).toLowerCase();
  const sslEnabled = !!sslMode && sslMode !== "disable";

  const baseConfig: PgPoolBaseConfig = {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 5432,
    database: url.pathname?.startsWith("/") ? url.pathname.slice(1) : url.pathname,
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
  };

  if (!sslEnabled) return baseConfig;

  // node-postgres doesn't fully implement libpq sslmode semantics.
  // Many hosted Postgres providers require ssl but don't present a chain trusted by Node.
  const rejectUnauthorizedDefault =
    sslMode === "verify-full" || sslMode === "verify-ca";
  const rejectUnauthorized =
    (process.env.PG_SSL_REJECT_UNAUTHORIZED || String(rejectUnauthorizedDefault))
      .toLowerCase() === "true";

  return {
    ...baseConfig,
    ssl: {
      rejectUnauthorized,
    },
  };
}

export function quoteIdent(ident: string): string {
  return `"${ident.replace(/\"/g, '""')}"`;
}

export function buildSearchPath(schemaName: string): string {
  const schema = (schemaName || "public").trim() || "public";
  if (schema === "public") return quoteIdent("public");

  const includePublic =
    (process.env.DB_SEARCH_PATH_INCLUDE_PUBLIC || "true").toLowerCase() !==
    "false";

  // Optional fallback to public during migration/transition.
  // Set DB_SEARCH_PATH_INCLUDE_PUBLIC=false for strict isolation.
  return includePublic
    ? `${quoteIdent(schema)}, ${quoteIdent("public")}`
    : `${quoteIdent(schema)}`;
}
