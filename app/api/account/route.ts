import { ensureReady } from "@/lib/bootstrap";
import { creditsToUsd } from "@/lib/cost";
import { fail, json } from "@/lib/http";
import { getApiKey } from "@/lib/settings";
import { SocqAuthError, SocqClient, errorMessage } from "@/lib/socq";

export const dynamic = "force-dynamic";

/**
 * GET /api/account → { credits, creditsUsd, topUpUrl }
 * Errors: 409 no_api_key, 401 invalid_api_key, 502 socq_unreachable.
 */
export async function GET() {
  const db = await ensureReady();
  const apiKey = await getApiKey(db);
  if (!apiKey) return fail(409, "no_api_key");
  try {
    const account = await new SocqClient({ apiKey }).getAccount();
    return json({
      credits: account.credits,
      creditsUsd: account.credits === null ? null : creditsToUsd(account.credits),
      topUpUrl: "https://socq.ai/pricing?utm_source=open-social-listening&utm_medium=app&utm_campaign=top-up",
    });
  } catch (error) {
    if (error instanceof SocqAuthError) return fail(401, "invalid_api_key");
    return fail(502, "socq_unreachable", { message: errorMessage(error) });
  }
}
