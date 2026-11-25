/**
 * Drizzle DB client.
 *
 * Uses postgres-js for Postgres.app, Docker compose Postgres, or Neon.
 * DATABASE_URL is required at runtime; without it `db` is the bottom
 * type and every callsite throws on first DB use. The build-time
 * ternary keeps `next build` from crashing when env is unset (CI /
 * local-without-DB), so unrelated route handlers can still typecheck
 * and compile.
 *
 * Neon notes:
 *   - SSL is auto-negotiated by postgres-js when the URL has
 *     `?sslmode=require` (Neon URLs always include it).
 *   - Neon's pooler endpoint runs in PgBouncer transaction mode,
 *     which does not support named prepared statements. We
 *     unconditionally set `prepare: false` — safe for all envs
 *     (direct, pooler, local) with negligible perf cost.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL;

type PgClient = postgres.Sql<Record<string, unknown>>;

const globalForDb = globalThis as typeof globalThis & {
  __dearmPgClient?: PgClient;
  __dearmPgClientUrl?: string;
};

const client = dbUrl
  ? globalForDb.__dearmPgClientUrl === dbUrl && globalForDb.__dearmPgClient
    ? globalForDb.__dearmPgClient
    : postgres(dbUrl, {
        max: 20,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
      })
  : (null as never);

if (dbUrl) {
  globalForDb.__dearmPgClient = client;
  globalForDb.__dearmPgClientUrl = dbUrl;
}

export const db = dbUrl ? drizzle(client, { schema }) : (null as never);

export { schema };
