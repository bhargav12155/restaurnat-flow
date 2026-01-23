import dotenv from "dotenv";
dotenv.config({ override: true });

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

import { buildPgPoolConfig, buildSearchPath, quoteIdent } from "./pgPoolConfig";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

const dbSchema = (process.env.DB_SCHEMA || "public").trim();
const autoCreateSchema = (process.env.DB_AUTO_CREATE_SCHEMA || "true").toLowerCase() !== "false";
export const pool = new Pool(buildPgPoolConfig(process.env.DATABASE_URL));

// Ensure every new pooled connection uses the desired schema.
// This keeps all ORM-generated SQL (which is typically unqualified) inside DB_SCHEMA.
pool.on("connect", async (client) => {
  if (autoCreateSchema && dbSchema && dbSchema !== "public") {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(dbSchema)}`);
  }

  if (dbSchema) {
    await client.query(`SET search_path TO ${buildSearchPath(dbSchema)}`);
  }
});
export const db = drizzle({ client: pool, schema });
