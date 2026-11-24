import type { SocqItem } from "@/lib/socq/types";
import type { Sentiment } from "@/lib/types";
import type { EndpointWindow, MentionInput, TimeWindow } from "./types";

const WINDOW_ORDER: EndpointWindow[] = ["hour", "day", "week", "month", "three_months", "six_months", "year", "all"];

/**
 * Pick the narrowest window the endpoint accepts that still covers `window`.
 * TikTok has no `hour`, so an hourly schedule searches the last `day`.
 */
export function pickWindow<T extends EndpointWindow>(window: TimeWindow, allowed: readonly T[]): T {
  const start = WINDOW_ORDER.indexOf(window);
  for (const candidate of WINDOW_ORDER.slice(start)) {
    if ((allowed as readonly EndpointWindow[]).includes(candidate)) return candidate as T;
  }
  return allowed[allowed.length - 1];
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Normalize to an ISO timestamp when parseable; keep the raw string otherwise. */
export function isoOrNull(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? raw : new Date(parsed).toISOString();
}

/** Social posts and short videos (`post` and `reel-video` schemas). */
export function mapSocialPost(platform: string) {
  return (item: SocqItem): MentionInput | null => {
    const url = str(item.url);
    if (!url) return null;
    const author = item.author ?? null;
    const metrics = item.metrics ?? null;
    return {
      platform,
      externalId: str(item.id),
      url,
      title: str(item.title),
      text: str(item.text),
      authorName: str(author?.name) ?? str(author?.username),
      authorHandle: str(author?.username),
      authorUrl: str(author?.url),
      authorAvatar: str(author?.avatar_url),
      publishedAt: isoOrNull(item.published_at),
      collectedAt: isoOrNull(item.collected_at),
      metrics: {
        likes: num(metrics?.likes_count),
        comments: num(metrics?.comments_count),
        shares: num(metrics?.shares_count),
        views: num(metrics?.views_count) ?? num(metrics?.plays_count),
      },
      sentiment: null,
    };
  };
}

/** Google News results (`news-article` schema). */
export function mapNewsArticle(item: SocqItem): MentionInput | null {
  const url = str(item.url);
  if (!url) return null;
  const publisher = str(item.source) ?? str(item.domain);
  return {
    platform: "news",
    externalId: str(item.id),
    url,
    title: str(item.title),
    text: str(item.text),
    authorName: publisher,
    authorHandle: str(item.domain),
    authorUrl: null,
    authorAvatar: null,
    publishedAt: isoOrNull(item.published_at),
    collectedAt: isoOrNull(item.collected_at),
    metrics: {},
    sentiment: null,
  };
}

/** Web, blog and forum mentions (`brand-mention` schema), which carry sentiment scores. */
export function mapBrandMention(item: SocqItem): MentionInput | null {
  const url = str(item.url);
  if (!url) return null;
  return {
    platform: "web",
    externalId: str(item.id),
    url,
    title: str(item.title),
    text: str(item.text),
    authorName: str(item.author_name) ?? str(item.domain),
    authorHandle: str(item.domain),
    authorUrl: null,
    authorAvatar: null,
    publishedAt: isoOrNull(item.published_at),
    collectedAt: isoOrNull(item.collected_at),
    metrics: {},
    sentiment: sentimentFromScores(item.sentiment),
  };
}

export function sentimentFromScores(scores: SocqItem["sentiment"]): Sentiment | null {
  if (!scores) return null;
  const entries: [Sentiment, number][] = [];
  for (const key of ["positive", "neutral", "negative"] as const) {
    const value = num(scores[key]);
    if (value !== null) entries.push([key, value]);
  }
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
