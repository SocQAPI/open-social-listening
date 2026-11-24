import { describe, expect, it } from "vitest";
import {
  enabledSources,
  getSource,
  mapBrandMention,
  mapNewsArticle,
  normalizeResultsLimit,
  pickWindow,
  resolveSourcesConfig,
  SOURCES,
  windowForInterval,
} from "@/lib/sources";
import type { SourceDefinition } from "@/lib/sources/types";

const source = (id: string): SourceDefinition => {
  const found = getSource(id);
  if (!found) throw new Error(`missing source ${id}`);
  return found;
};

describe("source registry", () => {
  it("has nine sources with unique ids and endpoints", () => {
    expect(SOURCES).toHaveLength(9);
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(9);
    expect(new Set(SOURCES.map((s) => s.endpoint)).size).toBe(9);
  });

  it("enables reddit, x, youtube, tiktok, news and web by default", () => {
    expect(enabledSources({}).map(({ source }) => source.id)).toEqual(["reddit", "x", "youtube", "tiktok", "news", "web"]);
  });

  it("respects explicit settings over defaults", () => {
    const resolved = resolveSourcesConfig({ reddit: { enabled: false }, threads: { enabled: true, resultsLimit: 50 } });
    expect(resolved.reddit.enabled).toBe(false);
    expect(resolved.threads).toEqual({ enabled: true, resultsLimit: 50 });
    expect(resolved.x).toEqual({ enabled: true, resultsLimit: 20 });
  });
});

describe("normalizeResultsLimit", () => {
  it("rounds LinkedIn up to a multiple of 10 with a minimum of 10", () => {
    expect(normalizeResultsLimit(source("linkedin"), 5)).toBe(10);
    expect(normalizeResultsLimit(source("linkedin"), 15)).toBe(20);
    expect(normalizeResultsLimit(source("linkedin"), 30)).toBe(30);
  });

  it("enforces the Instagram minimum of 20", () => {
    expect(normalizeResultsLimit(source("instagram"), 5)).toBe(20);
  });

  it("caps news at 200 and falls back to the default", () => {
    expect(normalizeResultsLimit(source("news"), 500)).toBe(200);
    expect(normalizeResultsLimit(source("news"), undefined)).toBe(20);
    expect(normalizeResultsLimit(source("news"), 0)).toBe(20);
  });
});

describe("windows", () => {
  it("maps schedule intervals to windows", () => {
    expect(windowForInterval(60)).toBe("hour");
    expect(windowForInterval(360)).toBe("day");
    expect(windowForInterval(1440)).toBe("day");
    expect(windowForInterval(10080)).toBe("week");
  });

  it("widens to the next window an endpoint supports", () => {
    expect(pickWindow("hour", ["day", "week"] as const)).toBe("day");
    expect(pickWindow("day", ["hour", "day"] as const)).toBe("day");
  });
});

describe("buildInput", () => {
  const options = { resultsLimit: 20, window: "hour" as const };

  it("reddit keeps the hour window", () => {
    expect(source("reddit").buildInput("acme", options)).toEqual({ query: "acme", published_within: "hour", results_limit: 20 });
  });

  it("tiktok has no hour window and sorts by date", () => {
    expect(source("tiktok").buildInput("acme", options)).toEqual({
      query: "acme",
      sort_by: "date",
      published_within: "day",
      results_limit: 20,
    });
  });

  it("youtube sorts by date with a time filter", () => {
    expect(source("youtube").buildInput("acme", { resultsLimit: 10, window: "week" })).toEqual({
      query: "acme",
      sort_by: "date",
      published_within: "week",
      results_limit: 10,
    });
  });

  it("x sorts by latest and has no time filter", () => {
    expect(source("x").buildInput("acme", options)).toEqual({ query: "acme", sort_by: "latest", results_limit: 20 });
  });

  it("threads only sends the query", () => {
    expect(source("threads").buildInput("acme", options)).toEqual({ query: "acme" });
  });

  it("news asks for English results", () => {
    expect(source("news").buildInput("acme", options)).toEqual({ query: "acme", language_code: "en", results_limit: 20 });
  });
});

describe("mappers", () => {
  it("maps a social post", () => {
    const mention = source("reddit").map({
      id: "t3_abc",
      url: "https://www.reddit.com/r/test/comments/abc/",
      published_at: "2026-11-20T10:00:00Z",
      collected_at: "2026-11-24T08:00:00Z",
      title: "Acme is great",
      text: "Body",
      author: { username: "jane", name: null, url: "https://www.reddit.com/user/jane", avatar_url: null },
      metrics: { likes_count: 12, comments_count: 3, shares_count: null, views_count: null },
    });
    expect(mention).toMatchObject({
      platform: "reddit",
      externalId: "t3_abc",
      url: "https://www.reddit.com/r/test/comments/abc/",
      title: "Acme is great",
      authorName: "jane",
      authorHandle: "jane",
      publishedAt: "2026-11-20T10:00:00.000Z",
      metrics: { likes: 12, comments: 3, shares: null, views: null },
      sentiment: null,
    });
  });

  it("uses plays as views for short videos", () => {
    const mention = source("tiktok").map({ url: "https://www.tiktok.com/@a/video/1", metrics: { plays_count: 900 } });
    expect(mention?.metrics.views).toBe(900);
  });

  it("drops items without a URL", () => {
    expect(source("x").map({ text: "no url" })).toBeNull();
  });

  it("maps news articles", () => {
    expect(
      mapNewsArticle({ url: "https://news.example/a", title: "Headline", source: "Example News", domain: "news.example" }),
    ).toMatchObject({ platform: "news", title: "Headline", authorName: "Example News", authorHandle: "news.example" });
  });

  it("picks the strongest sentiment for web mentions", () => {
    expect(
      mapBrandMention({ url: "https://blog.example/p", sentiment: { positive: 0.1, neutral: 0.2, negative: 0.7 } })?.sentiment,
    ).toBe("negative");
  });
});
