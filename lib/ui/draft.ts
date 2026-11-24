import { estimateMonthlyCredits, estimateRunCredits, runsPerMonth } from "@/lib/cost";
import { SOURCES, normalizeResultsLimit, resolveSourcesConfig } from "@/lib/sources";
import type { SourceDefinition } from "@/lib/sources";
import type { Competitor, SourcesConfig } from "@/lib/types";

/** Editable shape shared by onboarding and project settings. Competitors are edited by name. */
export interface ProjectDraft {
  name: string;
  brandTerms: string[];
  competitorNames: string[];
  keywords: string[];
  excludeTerms: string[];
  sources: Record<string, { enabled: boolean; resultsLimit: number }>;
  intervalMinutes: number;
  monthlyBudgetCredits: number;
}

export const INTERVALS = [
  { value: 360, label: "Every 6 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Daily" },
  { value: 10080, label: "Weekly" },
] as const;

export function defaultSources(): ProjectDraft["sources"] {
  return resolveSourcesConfig(null);
}

/** Keeps the extra search terms of competitors that already exist; new ones search by their name. */
export function toCompetitors(names: string[], existing: Competitor[] = []): Competitor[] {
  return names.map((name) => existing.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? { name, terms: [name] });
}

export function draftEstimate(draft: Pick<ProjectDraft, "brandTerms" | "competitorNames" | "keywords" | "sources" | "intervalMinutes">) {
  const input = {
    brandTerms: draft.brandTerms,
    keywords: draft.keywords,
    competitors: toCompetitors(draft.competitorNames),
    sources: draft.sources as SourcesConfig,
    intervalMinutes: draft.intervalMinutes,
  };
  const run = estimateRunCredits(input);
  const monthly = estimateMonthlyCredits(input);
  const searches = run.breakdown[0]?.terms ?? input.brandTerms.length + input.keywords.length + input.competitors.length;
  return { perRun: run.total, perMonth: monthly, runsPerMonth: runsPerMonth(draft.intervalMinutes), searches, breakdown: run.breakdown };
}

/** Credits one search costs on a source at the given results limit. */
export function searchCost(source: SourceDefinition, resultsLimit: number): number {
  const limit = normalizeResultsLimit(source, resultsLimit);
  return Math.round((source.pricing.base + source.pricing.perResult * limit) * 100) / 100;
}

/** Sensible budget: the estimate rounded up to the next 500 credits. */
export function suggestedBudget(perMonth: number): number {
  return Math.max(500, Math.ceil(perMonth / 500) * 500);
}

/** Results-per-search choices that the endpoint accepts. */
export function limitOptions(source: SourceDefinition): number[] {
  const opts = new Set<number>();
  for (const n of [10, 20, 50, 100]) opts.add(normalizeResultsLimit(source, n));
  opts.add(source.limits.default);
  return [...opts].sort((a, b) => a - b);
}

export { SOURCES };
