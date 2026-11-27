"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useApi } from "@/lib/ui/api";
import { cn } from "@/lib/ui/cn";
import { useI18n } from "@/lib/i18n";
import { creditsToUsd } from "@/lib/ui/format";
import { DailyBars } from "@/components/charts/daily-bars";
import { HBars, StackedShare, type ShareSegment } from "@/components/charts/share";
import { Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader, ProjectBanner, RunButton } from "@/components/shell/page-header";
import { useProject } from "@/components/shell/project-context";

interface Stats {
  range: { days: number; from: string; to: string };
  totals: { mentions: number; previousPeriod: number; unread: number; starred: number };
  daily: { date: string; total: number; bySource: Record<string, number> }[];
  bySource: Record<string, number>;
  shareOfVoice: { name: string; kind: "brand" | "competitor"; count: number; share: number }[];
  keywordMentions: number;
  sentiment: { positive: number; neutral: number; negative: number; unknown: number };
  credits: { thisMonth: number; thisMonthUsd: number; budget: number; estimatedMonthly: number; estimatedMonthlyUsd: number };
  recentRuns: { id: number; startedAt: string; finishedAt: string | null; status: string; creditsUsed: number; newMentions: number; error: string | null }[];
}

/** Competitors take categorical slots 2 and 3; any further ones fold into "Other" (never a generated hue). */
const VOICE_COLORS = ["bg-brand", "bg-comp-1", "bg-comp-2"];

/** Id of the source with the most mentions, or null. */
function topSource(bySource: Record<string, number>): string | null {
  let best: string | null = null;
  let max = 0;
  for (const [id, n] of Object.entries(bySource)) {
    if (n > max) {
      best = id;
      max = n;
    }
  }
  return best;
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface px-[18px] py-4">
      <span className="text-[13px] font-medium text-ink-3">{label}</span>
      <span className="font-display tabular text-[32px] leading-[1.1] font-semibold tracking-[-0.02em]">{value}</span>
      <span className="text-[13px] text-ink-3">{note}</span>
    </div>
  );
}

const statusPill: Record<string, string> = {
  succeeded: "bg-ok-bg text-ok-fg",
  partial: "bg-accent-tint text-[#7a2e0e]",
  failed: "bg-accent-tint text-[#7a2e0e]",
  running: "bg-info-bg text-info-fg",
};

export function DashboardView() {
  const { projectId, project, runVersion } = useProject();
  const { m: t, fmt } = useI18n();
  const d = t.dashboard;
  const formatInt = fmt.int;
  const sourceName = (id: string | null) => (id ? (t.sources[id] ?? id) : null);
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const stats = useApi<Stats>(`/api/stats?projectId=${projectId}&days=${days}`);
  const s = stats.data;

  useEffect(() => {
    void stats.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runVersion]);

  const spike = useMemo(() => {
    if (!s || s.daily.length < 4) return null;
    const recent = s.daily.slice(-3);
    const peak = recent.reduce((a, d) => (d.total > a.total ? d : a), recent[0]);
    const others = s.daily.filter((d) => d.date !== peak.date);
    // A brand-new project has no baseline; anything would look like a spike.
    if (others.filter((d) => d.total > 0).length < 4) return null;
    const avg = others.reduce((a, d) => a + d.total, 0) / Math.max(1, others.length);
    if (avg <= 0 || peak.total < 10 || peak.total < avg * 2.5) return null;
    return { date: peak.date, total: peak.total, ratio: peak.total / avg, top: topSource(peak.bySource) };
  }, [s]);

  const voices: ShareSegment[] = useMemo(() => {
    if (!s) return [];
    const brand = s.shareOfVoice.filter((v) => v.kind === "brand");
    const comps = [...s.shareOfVoice.filter((v) => v.kind === "competitor")].sort((a, b) => b.count - a.count);
    const list = [...brand, ...comps.slice(0, 2)].map((v, i) => ({
      key: `${v.kind}:${v.name}`,
      label: v.kind === "brand" ? d.you(v.name) : v.name,
      value: v.count,
      color: VOICE_COLORS[i] ?? "bg-neu-bar",
    }));
    const rest = comps.slice(2).reduce((a, v) => a + v.count, 0);
    if (comps.length > 2) list.push({ key: "other", label: d.otherCompetitors, value: rest, color: "bg-neu-bar" });
    return list;
  }, [s, d]);

  const sources = s
    ? Object.entries(s.bySource)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => ({ key: id, label: sourceName(id) ?? id, value: n }))
    : [];

  // A percentage over a tiny base ("+4900%") says nothing; compare raw counts until the base is meaningful.
  const change = s && s.totals.previousPeriod >= 10 ? Math.round(((s.totals.mentions - s.totals.previousPeriod) / s.totals.previousPeriod) * 100) : null;
  const changeNote = !s
    ? ""
    : change !== null
      ? d.changePct(`${change >= 0 ? "+" : "−"}${Math.abs(change)}`, days)
      : s.totals.previousPeriod > 0
        ? d.changeAbs(formatInt(s.totals.previousPeriod), days)
        : d.noEarlier;
  const brandVoice = s?.shareOfVoice.find((v) => v.kind === "brand");
  const scored = s ? s.sentiment.positive + s.sentiment.neutral + s.sentiment.negative : 0;
  const budget = s?.credits.budget ?? 0;
  const overBudget = s && budget > 0 && s.credits.estimatedMonthly > budget;
  const rangeLabel = d.ranges[days];

  return (
    <>
      <PageHeader
        title={d.title}
        actions={
          <>
            <Segmented<7 | 14 | 30>
              label={d.dateRange}
              value={days}
              onChange={setDays}
              options={[
                { value: 7, label: d.days(7) },
                { value: 14, label: d.days(14) },
                { value: 30, label: d.days(30) },
              ]}
            />
            <RunButton />
          </>
        }
      />
      <ProjectBanner />

      {spike && (
        <div role="status" className="animate-rise flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-tint">
            <TrendingUp aria-hidden="true" className="size-[18px] text-accent-text" />
          </span>
          <p className="m-0 flex-[1_1_320px]">
            <strong>{d.spikeTitle(fmt.shortDate(new Date(`${spike.date}T00:00:00`)))}</strong>
            {t.common.sentenceGap}
            {d.spikeBody(formatInt(spike.total), spike.ratio.toFixed(1), sourceName(spike.top))}
          </p>
          <Link href={`/p/${projectId}/inbox`} className="font-medium">
            {d.viewMentions}
          </Link>
        </div>
      )}

      <section aria-label={d.keyNumbers} className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {s ? (
          <>
            <Kpi
              label={d.mentionsKpi(days)}
              value={formatInt(s.totals.mentions)}
              note={changeNote}
            />
            <Kpi
              label={d.shareKpi}
              value={brandVoice ? `${Math.round(brandVoice.share * 100)}%` : "—"}
              note={s.shareOfVoice.length > 1 ? d.against(s.shareOfVoice.length - 1) : d.addCompetitors}
            />
            <Kpi
              label={d.negativeKpi}
              value={formatInt(s.sentiment.negative)}
              note={scored ? d.negativeNote(Math.round((s.sentiment.negative / scored) * 100), formatInt(scored)) : d.noSentiment}
            />
            <Kpi
              label={d.creditsKpi}
              value={formatInt(s.credits.thisMonth)}
              note={d.creditsNote(budget > 0 ? formatInt(budget) : null, creditsToUsd(s.credits.thisMonth))}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface px-[18px] py-4">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          ))
        )}
      </section>

      <Card aria-labelledby="perday" className="px-5 pt-[18px] pb-3.5">
        <CardHeader id="perday" title={d.perDay} meta={d.perDayMeta} />
        {s ? (
          s.totals.mentions === 0 ? (
            <EmptyState title={d.emptyPeriod}>{d.emptyPeriodNote}</EmptyState>
          ) : (
            <DailyBars label={d.perDayLabel(days)} data={s.daily.map((day) => ({ date: day.date, count: day.total, topSource: sourceName(topSource(day.bySource)) }))} />
          )
        ) : (
          <Skeleton className="mt-4 h-56 w-full" />
        )}
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
        <Card aria-labelledby="sov" className="flex flex-col gap-3.5 px-5 py-[18px]">
          <CardHeader id="sov" title={d.shareOfVoice} meta={rangeLabel} />
          {s ? voices.length ? <StackedShare label={d.shareOfVoice} segments={voices} /> : <p className="m-0 text-ink-3">{d.addBrand}</p> : <Skeleton className="h-24 w-full" />}
        </Card>

        <Card aria-labelledby="bysource" className="flex flex-col gap-3 px-5 py-[18px]">
          <CardHeader id="bysource" title={d.bySource} meta={rangeLabel} />
          {s ? sources.length ? <HBars rows={sources} /> : <p className="m-0 text-ink-3">{d.nothingYet}</p> : <Skeleton className="h-32 w-full" />}
        </Card>

        <Card aria-labelledby="sentiment" className="flex flex-col gap-3.5 px-5 py-[18px]">
          <CardHeader id="sentiment" title={d.sentiment} meta={d.sentimentMeta(rangeLabel)} />
          {s && scored === 0 ? (
            <p className="m-0 text-ink-3">{d.noSentimentPeriod}</p>
          ) : s ? (
            <>
              <StackedShare
                label={d.sentiment}
                segments={[
                  { key: "positive", label: t.sentiment.positive, value: s.sentiment.positive, color: "bg-pos" },
                  { key: "neutral", label: t.sentiment.neutral, value: s.sentiment.neutral, color: "bg-neu-bar" },
                  { key: "negative", label: t.sentiment.negative, value: s.sentiment.negative, color: "bg-neg" },
                ]}
              />
              {s.sentiment.unknown > 0 && (
                <p className="m-0 text-[13px] text-ink-3">{d.unscored(formatInt(s.sentiment.unknown))}</p>
              )}
            </>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </Card>
      </div>

      <Card aria-labelledby="runs" className="px-5 py-[18px]">
        <CardHeader
          id="runs"
          title={d.recentRuns}
          meta={s ? d.runsMeta(formatInt(s.credits.thisMonth), creditsToUsd(s.credits.thisMonth)) : undefined}
        />
        {overBudget && s && (
          <p className="m-0 mt-3 rounded-[10px] bg-accent-tint px-3.5 py-2.5 text-[13px] text-[#7a2e0e]">
            {d.overBudget(formatInt(s.credits.estimatedMonthly), formatInt(budget))}
            {t.common.sentenceGap}
            <Link href={`/p/${projectId}/settings`} className="font-semibold text-[#7a2e0e]">
              {d.adjust}
            </Link>
          </p>
        )}
        <div className="mt-2 overflow-x-auto">
          {s && s.recentRuns.length === 0 ? (
            <p className="m-0 py-4 text-ink-3">{project?.isDemo ? d.demoNoRuns : d.noRuns}</p>
          ) : (
            <table className="tabular w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th scope="col" className="py-2 font-medium">{d.started}</th>
                  <th scope="col" className="py-2 text-right font-medium">{d.newMentions}</th>
                  <th scope="col" className="py-2 text-right font-medium">{d.credits}</th>
                  <th scope="col" className="py-2 pl-4 font-medium">{d.status}</th>
                </tr>
              </thead>
              <tbody>
                {(s?.recentRuns ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-track">
                    <td className="py-2.5">{fmt.dateTime(r.startedAt)}</td>
                    <td className="py-2.5 text-right">{formatInt(r.newMentions)}</td>
                    <td className="py-2.5 text-right">{formatInt(r.creditsUsed)}</td>
                    <td className="py-2.5 pl-4">
                      <span title={r.error ?? undefined} className={cn("inline-flex min-h-6 items-center rounded-md px-2 text-xs font-semibold", statusPill[r.status] ?? "bg-subtle text-ink-2")}>
                        {d.statuses[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </>
  );
}
