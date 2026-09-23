import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { requireDb } from "@/lib/env";
import * as schema from "./schema";

/**
 * Neon connection pool (WebSocket driver) so we get real interactive
 * transactions — needed for atomic invoice numbering. In Node we must supply a
 * WebSocket implementation; on the edge/Vercel the platform provides one.
 *
 * Initialization is LAZY: the pool/connection is only created the first time a
 * query runs, not at import time. This keeps `next build` from requiring a live
 * `DATABASE_URL` just to compile, and the instance is memoized on `globalThis`
 * to survive HMR in development.
 */
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

type DrizzleDb = NeonDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __pool?: Pool;
  __db?: DrizzleDb;
};

function getDb(): DrizzleDb {
  if (!globalForDb.__db) {
    globalForDb.__pool = new Pool({ connectionString: requireDb() });
    globalForDb.__db = drizzle(globalForDb.__pool, { schema });
  }
  return globalForDb.__db;
}

/**
 * Lazy proxy that forwards every access to the real Drizzle client, created on
 * first use. Usage is identical to a normal `db` instance.
 */
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type DB = DrizzleDb;
export { schema };
