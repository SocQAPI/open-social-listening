import { getDb, migrate, type Db } from "@/db/client";
import { seedDemoIfEmpty } from "@/lib/demo/seed";
import { getApiKey } from "@/lib/settings";

const globalState = globalThis as typeof globalThis & { __oslReady?: Promise<Db> };

/**
 * Run migrations once per process and, on a fresh install without an API key,
 * seed the demo project so the UI has something to show.
 */
export function ensureReady(): Promise<Db> {
  if (!globalState.__oslReady) {
    globalState.__oslReady = (async () => {
      const db = getDb();
      await migrate();
      if (!(await getApiKey(db))) await seedDemoIfEmpty(db);
      return db;
    })().catch((error: unknown) => {
      globalState.__oslReady = undefined;
      throw error;
    });
  }
  return globalState.__oslReady;
}
