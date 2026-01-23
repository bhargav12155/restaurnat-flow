import { defineConfig } from "drizzle-kit";

import dotenv from "dotenv";
dotenv.config({ override: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

function withSearchPath(urlStr: string, schemaName: string): string {
  const schema = (schemaName || "").trim();
  if (!schema || schema === "public") return urlStr;

  const includePublic =
    (process.env.DB_SEARCH_PATH_INCLUDE_PUBLIC || "true").toLowerCase() !==
    "false";

  const url = new URL(urlStr);
  // Postgres supports passing options via libpq-style `options` parameter.
  // Example: options=-c%20search_path%3Dmyschema
  const options = includePublic
    ? `-c search_path=${schema},public`
    : `-c search_path=${schema}`;
  url.searchParams.set("options", options);
  return url.toString();
}

const dbSchema = process.env.DB_SCHEMA || "public";
const databaseUrl = withSearchPath(process.env.DATABASE_URL, dbSchema);

const schemaFilter = [dbSchema.trim() || "public"];

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  schemaFilter,
  dbCredentials: {
    url: databaseUrl,
  },
});
