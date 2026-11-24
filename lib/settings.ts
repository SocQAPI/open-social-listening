import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { settings } from "@/db/schema";

const API_KEY_SETTING = "socq_api_key";

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string | null): Promise<void> {
  if (value === null) {
    await db.delete(settings).where(eq(settings.key, key));
    return;
  }
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export type ApiKeySource = "env" | "db";

export interface ApiKeyInfo {
  configured: boolean;
  source: ApiKeySource | null;
  /** Last four characters only, e.g. "••••3f9a". */
  preview: string | null;
}

function envApiKey(): string | null {
  return process.env.SOCQ_API_KEY?.trim() || null;
}

/** The SocQ key in use: `SOCQ_API_KEY` wins over the key saved from the settings page. */
export async function getApiKey(db: Db): Promise<string | null> {
  return envApiKey() ?? (await getSetting(db, API_KEY_SETTING));
}

export async function getApiKeyInfo(db: Db): Promise<ApiKeyInfo> {
  const env = envApiKey();
  const key = env ?? (await getSetting(db, API_KEY_SETTING));
  return {
    configured: Boolean(key),
    source: env ? "env" : key ? "db" : null,
    preview: key ? `••••${key.slice(-4)}` : null,
  };
}

export function isApiKeyFromEnv(): boolean {
  return envApiKey() !== null;
}

export async function saveApiKey(db: Db, apiKey: string | null): Promise<void> {
  await setSetting(db, API_KEY_SETTING, apiKey?.trim() || null);
}
