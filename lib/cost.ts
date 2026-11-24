import { enabledSources } from "@/lib/sources";
import type { SourceId } from "@/lib/sources/types";
import { expandTerms, type TermSource } from "@/lib/terms";
import type { SourcesConfig } from "@/lib/types";

/** SocQ pay-as-you-go: $5 buys 1,000 credits. */
export const USD_PER_CREDIT = 0.005;

export interface EstimateInput extends TermSource {
  sources: SourcesConfig;
  intervalMinutes: number;
}

export interface SourceEstimate {
  source: SourceId;
  label: string;
  terms: number;
  resultsLimit: number;
  credits: number;
}

export interface RunEstimate {
  /** Upper bound: SocQ bills the records actually returned, so real runs usually cost less. */
  total: number;
  breakdown: SourceEstimate[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function creditsToUsd(credits: number): number {
  return round2(credits * USD_PER_CREDIT);
}

export function runsPerMonth(intervalMinutes: number): number {
  const minutes = Math.max(1, intervalMinutes);
  return (30 * 24 * 60) / minutes;
}

export function estimateRunCredits(input: Omit<EstimateInput, "intervalMinutes">): RunEstimate {
  const terms = expandTerms(input).length;
  const breakdown = enabledSources(input.sources).map(({ source, resultsLimit }) => ({
    source: source.id,
    label: source.label,
    terms,
    resultsLimit,
    credits: round2(terms * (source.pricing.base + source.pricing.perResult * resultsLimit)),
  }));
  return {
    total: round2(breakdown.reduce((sum, item) => sum + item.credits, 0)),
    breakdown,
  };
}

export function estimateMonthlyCredits(input: EstimateInput): number {
  return round2(estimateRunCredits(input).total * runsPerMonth(input.intervalMinutes));
}
