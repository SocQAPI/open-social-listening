import type { AlertChannelRow, MentionRow, ProjectRow } from "@/db/schema";
import { creditsToUsd, estimateMonthlyCredits, estimateRunCredits } from "@/lib/cost";
import { isRunning } from "@/lib/runner";
import { resolveSourcesConfig } from "@/lib/sources";
import type { MentionMetrics, Sentiment, TermKind } from "@/lib/types";

export interface MentionDTO {
  id: number;
  projectId: number;
  source: string;
  platform: string;
  url: string;
  title: string | null;
  text: string | null;
  author: { name: string | null; handle: string | null; url: string | null; avatar: string | null };
  publishedAt: string | null;
  collectedAt: string | null;
  /** The timestamp the inbox sorts by (published, else collected, else stored). */
  sortAt: string;
  metrics: MentionMetrics;
  matchedTerm: string;
  termKind: TermKind;
  competitorName: string | null;
  sentiment: Sentiment | null;
  starred: boolean;
  read: boolean;
}

export function toMentionDTO(row: MentionRow): MentionDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    source: row.source,
    platform: row.platform,
    url: row.url,
    title: row.title,
    text: row.text,
    author: { name: row.authorName, handle: row.authorHandle, url: row.authorUrl, avatar: row.authorAvatar },
    publishedAt: row.publishedAt,
    collectedAt: row.collectedAt,
    sortAt: row.sortAt,
    metrics: row.metrics ?? {},
    matchedTerm: row.matchedTerm,
    termKind: row.termKind,
    competitorName: row.competitorName,
    sentiment: row.sentiment ?? null,
    starred: row.starred,
    read: row.read,
  };
}

export function toProjectDTO(row: ProjectRow, counts?: { mentions: number; unread: number }) {
  const runEstimate = estimateRunCredits(row);
  const monthly = estimateMonthlyCredits(row);
  const nextRunAt =
    row.paused || row.isDemo
      ? null
      : row.lastRunAt
        ? new Date(Date.parse(row.lastRunAt) + row.intervalMinutes * 60_000).toISOString()
        : new Date().toISOString();
  return {
    id: row.id,
    name: row.name,
    brandTerms: row.brandTerms,
    keywords: row.keywords,
    competitors: row.competitors,
    excludeTerms: row.excludeTerms,
    sources: resolveSourcesConfig(row.sources),
    intervalMinutes: row.intervalMinutes,
    monthlyBudgetCredits: row.monthlyBudgetCredits,
    paused: row.paused,
    pausedReason: row.pausedReason ?? null,
    isDemo: row.isDemo,
    running: isRunning(row.id),
    lastRunAt: row.lastRunAt,
    nextRunAt,
    createdAt: row.createdAt,
    estimate: {
      perRunCredits: runEstimate.total,
      perMonthCredits: monthly,
      perMonthUsd: creditsToUsd(monthly),
      breakdown: runEstimate.breakdown,
    },
    ...(counts ? { counts } : {}),
  };
}

export type ProjectDTO = ReturnType<typeof toProjectDTO>;

export function toAlertDTO(row: AlertChannelRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    target: row.target,
    enabled: row.enabled,
    spikeMultiplier: row.spikeMultiplier,
    createdAt: row.createdAt,
  };
}
