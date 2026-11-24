import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { mentions, projects, runs } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { creditsToUsd, estimateMonthlyCredits } from "@/lib/cost";
import { fail, json, parseId } from "@/lib/http";
import { creditsUsedThisMonth } from "@/lib/runner";
import { SOURCE_IDS } from "@/lib/sources";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/stats?projectId=1[&days=14]
 * → {
 *   range: { days, from, to },
 *   totals: { mentions, previousPeriod, unread, starred },
 *   daily: [{ date: "YYYY-MM-DD", total, bySource: { reddit: n, … } }],   // oldest first, zero-filled
 *   bySource: { reddit: n, … },
 *   shareOfVoice: [{ name, kind: "brand" | "competitor", count, share }],  // keyword mentions excluded
 *   keywordMentions: n,
 *   sentiment: { positive, neutral, negative, unknown },
 *   credits: { thisMonth, thisMonthUsd, budget, estimatedMonthly, estimatedMonthlyUsd },
 *   recentRuns: [{ id, startedAt, finishedAt, status, creditsUsed, newMentions, error }]
 * }
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectId = parseId(params.get("projectId"));
  if (!projectId) return fail(400, "project_id_required");
  const days = Math.min(Math.max(Number(params.get("days")) || 14, 1), 90);

  const db = await ensureReady();
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return fail(404, "project_not_found");

  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const fromMs = todayStart - (days - 1) * DAY_MS;
  const from = new Date(fromMs).toISOString();
  const previousFrom = new Date(fromMs - days * DAY_MS).toISOString();
  const inWindow = and(eq(mentions.projectId, projectId), gte(mentions.sortAt, from));

  const dayExpr = sql<string>`substr(${mentions.sortAt}, 1, 10)`;
  const [dailyRows, sovRows, sentimentRows, totalRow, previousRow, unreadRow, starredRow, recentRuns, creditsThisMonth] =
    await Promise.all([
      db
        .select({ day: dayExpr, source: mentions.source, n: count() })
        .from(mentions)
        .where(inWindow)
        .groupBy(dayExpr, mentions.source),
      db
        .select({ kind: mentions.termKind, competitor: mentions.competitorName, n: count() })
        .from(mentions)
        .where(inWindow)
        .groupBy(mentions.termKind, mentions.competitorName),
      db.select({ sentiment: mentions.sentiment, n: count() }).from(mentions).where(inWindow).groupBy(mentions.sentiment),
      db.select({ n: count() }).from(mentions).where(inWindow).get(),
      db
        .select({ n: count() })
        .from(mentions)
        .where(and(eq(mentions.projectId, projectId), gte(mentions.sortAt, previousFrom), lt(mentions.sortAt, from)))
        .get(),
      db
        .select({ n: count() })
        .from(mentions)
        .where(and(eq(mentions.projectId, projectId), eq(mentions.read, false)))
        .get(),
      db
        .select({ n: count() })
        .from(mentions)
        .where(and(eq(mentions.projectId, projectId), eq(mentions.starred, true)))
        .get(),
      db.select().from(runs).where(eq(runs.projectId, projectId)).orderBy(desc(runs.startedAt)).limit(10),
      creditsUsedThisMonth(db, projectId, now),
    ]);

  const emptyBySource = () => Object.fromEntries(SOURCE_IDS.map((id) => [id, 0])) as Record<string, number>;
  const daily = Array.from({ length: days }, (_, index) => ({
    date: new Date(fromMs + index * DAY_MS).toISOString().slice(0, 10),
    total: 0,
    bySource: emptyBySource(),
  }));
  const byDate = new Map(daily.map((entry) => [entry.date, entry]));
  const bySource = emptyBySource();
  for (const row of dailyRows) {
    const entry = byDate.get(row.day);
    const n = Number(row.n);
    bySource[row.source] = (bySource[row.source] ?? 0) + n;
    if (!entry) continue;
    entry.total += n;
    entry.bySource[row.source] = (entry.bySource[row.source] ?? 0) + n;
  }

  const brandName = project.brandTerms[0] ?? project.name;
  const voices = new Map<string, { name: string; kind: "brand" | "competitor"; count: number }>();
  if (project.brandTerms.length) voices.set("brand", { name: brandName, kind: "brand", count: 0 });
  for (const competitor of project.competitors) {
    voices.set(`competitor:${competitor.name}`, { name: competitor.name, kind: "competitor", count: 0 });
  }
  let keywordMentions = 0;
  for (const row of sovRows) {
    const n = Number(row.n);
    if (row.kind === "keyword") keywordMentions += n;
    else if (row.kind === "brand") {
      const voice = voices.get("brand") ?? { name: brandName, kind: "brand" as const, count: 0 };
      voice.count += n;
      voices.set("brand", voice);
    } else {
      const name = row.competitor ?? "Competitor";
      const key = `competitor:${name}`;
      const voice = voices.get(key) ?? { name, kind: "competitor" as const, count: 0 };
      voice.count += n;
      voices.set(key, voice);
    }
  }
  const voiceTotal = [...voices.values()].reduce((sum, voice) => sum + voice.count, 0);
  const shareOfVoice = [...voices.values()].map((voice) => ({
    ...voice,
    share: voiceTotal ? Math.round((voice.count / voiceTotal) * 1000) / 1000 : 0,
  }));

  const sentiment = { positive: 0, neutral: 0, negative: 0, unknown: 0 };
  for (const row of sentimentRows) {
    const key = row.sentiment ?? "unknown";
    sentiment[key] += Number(row.n);
  }

  const estimatedMonthly = estimateMonthlyCredits(project);
  return json({
    range: { days, from, to: now.toISOString() },
    totals: {
      mentions: Number(totalRow?.n ?? 0),
      previousPeriod: Number(previousRow?.n ?? 0),
      unread: Number(unreadRow?.n ?? 0),
      starred: Number(starredRow?.n ?? 0),
    },
    daily,
    bySource,
    shareOfVoice,
    keywordMentions,
    sentiment,
    credits: {
      thisMonth: creditsThisMonth,
      thisMonthUsd: creditsToUsd(creditsThisMonth),
      budget: project.monthlyBudgetCredits,
      estimatedMonthly,
      estimatedMonthlyUsd: creditsToUsd(estimatedMonthly),
    },
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      status: run.status,
      creditsUsed: run.creditsUsed,
      newMentions: run.newMentions,
      error: run.error,
    })),
  });
}
