import { ensureReady } from "@/lib/bootstrap";
import { creditsToUsd } from "@/lib/cost";
import { fail, invalid, json, readJson } from "@/lib/http";
import { getApiKeyInfo, isApiKeyFromEnv, saveApiKey } from "@/lib/settings";
import { SocqAuthError, SocqClient, errorMessage } from "@/lib/socq";
import { settingsUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function snapshot() {
  const db = await ensureReady();
  return {
    apiKey: await getApiKeyInfo(db),
    scheduler: { enabled: process.env.OSL_DISABLE_SCHEDULER !== "1" },
    passwordProtected: Boolean(process.env.OSL_PASSWORD),
    email: { configured: Boolean(process.env.SMTP_URL?.trim()) },
  };
}

/**
 * GET /api/settings → {
 *   apiKey: { configured, source: "env" | "db" | null, preview: "••••abcd" | null },
 *   scheduler: { enabled }, passwordProtected, email: { configured }
 * }
 */
export async function GET() {
  return json(await snapshot());
}

/**
 * PUT /api/settings { apiKey: string | null }
 * A new key is checked against GET /v1/account before it is saved.
 * → settings snapshot + { account: { credits, creditsUsd } }
 * Errors: 400 invalid_api_key, 409 api_key_managed_by_env, 502 socq_unreachable.
 */
export async function PUT(request: Request) {
  const parsed = settingsUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  if (isApiKeyFromEnv()) return fail(409, "api_key_managed_by_env");
  const db = await ensureReady();

  if (parsed.data.apiKey === null) {
    await saveApiKey(db, null);
    return json({ ...(await snapshot()), account: null });
  }

  try {
    const account = await new SocqClient({ apiKey: parsed.data.apiKey }).getAccount();
    await saveApiKey(db, parsed.data.apiKey);
    const credits = account.credits;
    return json({
      ...(await snapshot()),
      account: { credits, creditsUsd: credits === null ? null : creditsToUsd(credits) },
    });
  } catch (error) {
    if (error instanceof SocqAuthError) return fail(400, "invalid_api_key");
    return fail(502, "socq_unreachable", { message: errorMessage(error) });
  }
}
