import { drizzle } from "drizzle-orm/sql-js";
import type { Db } from "@/db/client";
import { MIGRATIONS } from "@/db/migrations";
import * as schema from "@/db/schema";
import { seedDemoIfEmpty } from "@/lib/demo/seed";
import { BASE_PATH } from "@/lib/demo/static";

/**
 * Stands in for lib/bootstrap in the static demo build (aliased in next.config.ts): the database is
 * sql.js in the browser, migrated and seeded on page load, so the demo's dates are always recent.
 */

interface SqlJsDatabase {
  exec(sql: string): unknown;
}

export interface SqlJsStatic {
  Database: new () => SqlJsDatabase;
}

declare global {
  interface Window {
    initSqlJs?: (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

/** A migrated, seeded demo database. Exported for the tests, which pass Node's sql.js. */
export async function createDemoDb(SQL: SqlJsStatic): Promise<Db> {
  const database = new SQL.Database();
  for (const migration of MIGRATIONS) database.exec(migration.sql);
  // The sql.js driver shares the SQLite query builder with libsql, so every route runs unchanged.
  const db = drizzle(database as never, { schema }) as unknown as Db;
  await seedDemoIfEmpty(db);
  return db;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

let ready: Promise<Db> | undefined;

export function ensureReady(): Promise<Db> {
  ready ??= (async () => {
    // sql.js ships as a plain script plus a .wasm file, copied to /sql by scripts/build-demo.mjs.
    if (!window.initSqlJs) await loadScript(`${BASE_PATH}/sql/sql-wasm.js`);
    const SQL = await window.initSqlJs!({ locateFile: (file) => `${BASE_PATH}/sql/${file}` });
    return createDemoDb(SQL);
  })().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}
