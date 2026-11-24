import { describe, expect, it } from "vitest";
import { creditsToUsd, estimateMonthlyCredits, estimateRunCredits, runsPerMonth } from "@/lib/cost";
import { expandTerms, isExcluded } from "@/lib/terms";

const only = (id: string, resultsLimit = 20) => ({
  reddit: { enabled: false },
  x: { enabled: false },
  youtube: { enabled: false },
  tiktok: { enabled: false },
  news: { enabled: false },
  web: { enabled: false },
  [id]: { enabled: true, resultsLimit },
});

describe("estimateRunCredits", () => {
  it("prices per result", () => {
    const estimate = estimateRunCredits({ brandTerms: ["Acme"], keywords: [], competitors: [], sources: only("reddit") });
    expect(estimate.total).toBe(12);
    expect(estimate.breakdown).toEqual([{ source: "reddit", label: "Reddit", terms: 1, resultsLimit: 20, credits: 12 }]);
  });

  it("adds the per-request base for web mentions", () => {
    const estimate = estimateRunCredits({ brandTerms: ["Acme"], keywords: [], competitors: [], sources: only("web") });
    expect(estimate.total).toBe(10.4);
  });

  it("multiplies by every term, including competitor terms", () => {
    const estimate = estimateRunCredits({
      brandTerms: ["Acme"],
      keywords: ["note app"],
      competitors: [{ name: "Globex", terms: ["Globex", "Globex Docs"] }],
      sources: only("x"),
    });
    expect(estimate.total).toBe(4 * 14);
  });

  it("matches the default six-source estimate for one term", () => {
    const estimate = estimateRunCredits({ brandTerms: ["Acme"], keywords: [], competitors: [], sources: {} });
    // reddit 12 + x 14 + youtube 10 + tiktok 14 + news 2 + web 10.4
    expect(estimate.total).toBe(62.4);
  });
});

describe("monthly estimate", () => {
  it("assumes 30 runs a month for a daily schedule", () => {
    expect(runsPerMonth(1440)).toBe(30);
    expect(
      estimateMonthlyCredits({ brandTerms: ["Acme"], keywords: [], competitors: [], sources: only("reddit"), intervalMinutes: 1440 }),
    ).toBe(360);
  });

  it("converts credits to dollars", () => {
    expect(creditsToUsd(1000)).toBe(5);
    expect(creditsToUsd(62.4)).toBe(0.31);
  });
});

describe("terms", () => {
  it("tags terms and drops case-insensitive duplicates", () => {
    expect(
      expandTerms({
        brandTerms: ["Acme", "acme "],
        keywords: ["note app"],
        competitors: [{ name: "Globex", terms: ["Globex"] }],
      }),
    ).toEqual([
      { term: "Acme", kind: "brand", competitorName: null },
      { term: "Globex", kind: "competitor", competitorName: "Globex" },
      { term: "note app", kind: "keyword", competitorName: null },
    ]);
  });

  it("excludes mentions containing an exclude term", () => {
    expect(isExcluded({ title: "We're HIRING", text: null, authorHandle: null }, ["hiring"])).toBe(true);
    expect(isExcluded({ title: "Great app", text: null, authorHandle: null }, ["hiring"])).toBe(false);
  });
});
