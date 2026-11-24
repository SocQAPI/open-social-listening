import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { MIGRATIONS } from "./migrations";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

interface DbState {
  client: Client;
  db: Db;
}

// Survive dev-server hot reloads without opening a new connection each time.
const globalState = globalThis as typeof globalThis & { __oslDb?: DbState };

export function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || "file:./data/osl.db";
}

function ensureDirectory(url: string) {
  if (!url.startsWith("file:")) return;
  const path = url.slice("file:".length);
  if (!path || path === ":memory:") return;
  mkdirSync(dirname(resolve(path)), { recursive: true });
}

function state(): DbState {
  if (!globalState.__oslDb) {
    const url = databaseUrl();
    ensureDirectory(url);
    const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
    globalState.__oslDb = { client, db: drizzle(client, { schema }) };
  }
  return globalState.__oslDb;
}

export function getClient(): Client {
  return state().client;
}

/** The Drizzle handle. Call `ensureReady()` from `lib/bootstrap` first so migrations have run. */
export function getDb(): Db {
  return state().db;
}

export async function migrate(client: Client = getClient()): Promise<string[]> {
  if (databaseUrl().startsWith("file:")) {
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 5000");
  }
  await client.execute("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set((await client.execute("SELECT id FROM _migrations")).rows.map((row) => String(row.id)));
  const ran: string[] = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    await client.executeMultiple(migration.sql);
    await client.execute({
      sql: "INSERT INTO _migrations (id, applied_at) VALUES (?, ?)",
      args: [migration.id, new Date().toISOString()],
    });
    ran.push(migration.id);
  }
  return ran;
}
