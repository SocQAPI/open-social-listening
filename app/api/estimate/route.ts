import { creditsToUsd, estimateRunCredits, runsPerMonth } from "@/lib/cost";
import { invalid, json, readJson } from "@/lib/http";
import { defaultSourcesConfig } from "@/lib/sources";
import { estimateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/estimate { brandTerms?, keywords?, competitors?, sources?, intervalMinutes? }
 * → { perRunCredits, perMonthCredits, perMonthUsd, runsPerMonth, breakdown: [{ source, label, terms, resultsLimit, credits }] }
 * Upper bound: SocQ bills the records actually returned.
 */
export async function POST(request: Request) {
  const parsed = estimateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const draft = parsed.data;
  const run = estimateRunCredits({ ...draft, sources: { ...defaultSourcesConfig(), ...(draft.sources ?? {}) } });
  const runs = runsPerMonth(draft.intervalMinutes);
  const perMonthCredits = Math.round(run.total * runs * 100) / 100;
  return json({
    perRunCredits: run.total,
    perMonthCredits,
    perMonthUsd: creditsToUsd(perMonthCredits),
    runsPerMonth: Math.round(runs * 100) / 100,
    breakdown: run.breakdown,
  });
}
