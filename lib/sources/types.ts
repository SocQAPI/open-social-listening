import type { SocqItem } from "@/lib/socq/types";
import type { MentionMetrics, Sentiment } from "@/lib/types";

export type SourceId = "reddit" | "x" | "youtube" | "tiktok" | "instagram" | "linkedin" | "threads" | "news" | "web";

/** Look-back window derived from the project's schedule interval. */
export type TimeWindow = "hour" | "day" | "week";

/** Every window value any SocQ search endpoint accepts, coarsest last. */
export type EndpointWindow = "hour" | "day" | "week" | "month" | "three_months" | "six_months" | "year" | "all";

export interface BuildInputOptions {
  /** Already normalized with `normalizeResultsLimit`. */
  resultsLimit: number;
  window: TimeWindow;
}

/** A mention as mapped from one SocQ result item, before it is tied to a project. */
export interface MentionInput {
  platform: string;
  externalId: string | null;
  url: string;
  title: string | null;
  text: string | null;
  authorName: string | null;
  authorHandle: string | null;
  authorUrl: string | null;
  authorAvatar: string | null;
  publishedAt: string | null;
  collectedAt: string | null;
  metrics: MentionMetrics;
  sentiment: Sentiment | null;
}

export interface SourceDefinition {
  id: SourceId;
  label: string;
  platform: string;
  /** SocQ public endpoint id, submitted as `POST /v1/{endpoint}`. */
  endpoint: string;
  /** Credits: `base` per request plus `perResult` per returned record. */
  pricing: { base: number; perResult: number };
  limits: {
    min: number;
    max: number;
    /** results_limit must be a multiple of this value. */
    step?: number;
    default: number;
  };
  /** False when the endpoint takes no results_limit (the estimate then assumes `limits.default`). */
  supportsResultsLimit: boolean;
  defaultEnabled: boolean;
  buildInput(term: string, options: BuildInputOptions): Record<string, unknown>;
  map(item: SocqItem): MentionInput | null;
}
