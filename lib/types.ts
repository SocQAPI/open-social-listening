export type TermKind = "brand" | "competitor" | "keyword";
export type Sentiment = "positive" | "neutral" | "negative";
export type PausedReason = "budget" | "manual" | "auth" | "credits";
export type AlertKind = "slack" | "discord" | "webhook" | "email";
export type RunStatus = "running" | "succeeded" | "partial" | "failed";
export type SourceTaskStatus = "submitting" | "running" | "succeeded" | "failed";

export interface Competitor {
  name: string;
  terms: string[];
}

export interface SourceSetting {
  enabled: boolean;
  resultsLimit?: number;
}

/** Per-source settings keyed by source id. Missing ids fall back to the source defaults. */
export type SourcesConfig = Record<string, SourceSetting>;

export interface MentionMetrics {
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  views?: number | null;
}

export interface TermSpec {
  term: string;
  kind: TermKind;
  competitorName: string | null;
}
