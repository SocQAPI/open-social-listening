import type { SourcesConfig } from "@/lib/types";
import { instagram } from "./instagram";
import { linkedin } from "./linkedin";
import { news } from "./news";
import { reddit } from "./reddit";
import { threads } from "./threads";
import { tiktok } from "./tiktok";
import type { SourceDefinition, SourceId, TimeWindow } from "./types";
import { web } from "./web";
import { x } from "./x";
import { youtube } from "./youtube";

export type * from "./types";
export { mapBrandMention, mapNewsArticle, mapSocialPost, pickWindow, sentimentFromScores } from "./map";

/** Display order for the UI. */
export const SOURCES: readonly SourceDefinition[] = [reddit, x, youtube, tiktok, instagram, linkedin, threads, news, web];

export const SOURCE_IDS: readonly SourceId[] = SOURCES.map((source) => source.id);

export function isSourceId(value: string): value is SourceId {
  return (SOURCE_IDS as readonly string[]).includes(value);
}

export function getSource(id: string): SourceDefinition | undefined {
  return SOURCES.find((source) => source.id === id);
}

/** Clamp a requested results_limit to the endpoint's minimum, maximum and step. */
export function normalizeResultsLimit(source: SourceDefinition, requested?: number | null): number {
  const { min, max, step } = source.limits;
  let value = Number.isFinite(requested) && requested ? Math.round(requested) : source.limits.default;
  value = Math.min(Math.max(value, min), max);
  if (step && value % step !== 0) value = Math.min(Math.ceil(value / step) * step, max);
  return value;
}

/** Schedule interval (minutes) → the look-back window used for time-filtered searches. */
export function windowForInterval(intervalMinutes: number): TimeWindow {
  if (intervalMinutes <= 60) return "hour";
  if (intervalMinutes <= 24 * 60) return "day";
  return "week";
}

/** Settings for every source, filling defaults for ids the project has not configured. */
export function resolveSourcesConfig(config: SourcesConfig | null | undefined): Record<SourceId, { enabled: boolean; resultsLimit: number }> {
  const resolved = {} as Record<SourceId, { enabled: boolean; resultsLimit: number }>;
  for (const source of SOURCES) {
    const setting = config?.[source.id];
    resolved[source.id] = {
      enabled: setting ? Boolean(setting.enabled) : source.defaultEnabled,
      resultsLimit: normalizeResultsLimit(source, setting?.resultsLimit),
    };
  }
  return resolved;
}

/** The enabled sources of a project, in display order, with normalized limits. */
export function enabledSources(config: SourcesConfig | null | undefined): { source: SourceDefinition; resultsLimit: number }[] {
  const resolved = resolveSourcesConfig(config);
  return SOURCES.filter((source) => resolved[source.id].enabled).map((source) => ({
    source,
    resultsLimit: resolved[source.id].resultsLimit,
  }));
}

/** Default per-source configuration for a new project. */
export function defaultSourcesConfig(): SourcesConfig {
  return Object.fromEntries(
    SOURCES.map((source) => [source.id, { enabled: source.defaultEnabled, resultsLimit: source.limits.default }]),
  );
}
