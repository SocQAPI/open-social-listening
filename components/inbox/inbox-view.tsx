"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, Search, Star } from "lucide-react";
import { STATIC_DEMO } from "@/lib/demo/static";
import type { MentionDTO } from "@/lib/dto";
import { getSource } from "@/lib/sources";
import { api, errorText, useApi, useDebounced } from "@/lib/ui/api";
import { cn } from "@/lib/ui/cn";
import { useI18n, type Messages } from "@/lib/i18n";
import { splitHighlight } from "@/lib/ui/format";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Select, Skeleton } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { SentimentTag, SourceBadge, TermChip, type TermKind } from "@/components/ui/tokens";
import { useToast } from "@/components/ui/toast";
import { PageHeader, ProjectBanner, RunButton } from "@/components/shell/page-header";
import { useProject } from "@/components/shell/project-context";

type KindFilter = "all" | TermKind;
type SentimentFilter = "any" | "positive" | "neutral" | "negative";

interface StatsForCounts {
  totals: { mentions: number };
  bySource: Record<string, number>;
  shareOfVoice: { kind: "brand" | "competitor"; count: number }[];
  keywordMentions: number;
}

/** Same calendar-day (UTC) window as /api/stats, so filter counts and the list agree. */
function periodStart(days: number): string {
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayStart - (days - 1) * 86_400_000).toISOString();
}

const PERIODS = [1, 7, 30, 90];

type MetricName = keyof Messages["inbox"]["metricTitles"];

/** Reddit calls likes upvotes; TikTok and Instagram call views plays. */
function metricName(source: string, key: "likes" | "comments" | "shares" | "views"): MetricName {
  if (key === "likes") return source === "reddit" ? "upvotes" : "likes";
  if (key === "views") return source === "tiktok" || source === "instagram" ? "plays" : "views";
  return key;
}

function metricList(m: MentionDTO): { name: MetricName; value: number }[] {
  const keys = ["likes", "comments", "shares", "views"] as const;
  return keys
    .filter((k) => m.metrics[k] !== null && m.metrics[k] !== undefined)
    .map((k) => ({ name: metricName(m.source, k), value: Number(m.metrics[k]) }));
}

function headline(m: MentionDTO): string {
  return (m.title && m.text ? m.title : (m.text ?? m.title)) ?? m.url;
}

function authorName(m: MentionDTO, sources: Messages["sources"]): string {
  return m.author.name ?? m.author.handle ?? (() => {
    try {
      return new URL(m.url).hostname.replace(/^www\./, "");
    } catch {
      return sources[m.source] ?? m.source;
    }
  })();
}

function authorWhere(m: MentionDTO): string | null {
  const handle = m.author.handle;
  if (!handle || handle === m.author.name) return null;
  if (m.source === "reddit" || handle.startsWith("@") || handle.includes("/")) return handle;
  return `@${handle}`;
}

function Highlighted({ text, term }: { text: string; term: string }) {
  const [pre, hit, post] = splitHighlight(text, term);
  return (
    <>
      {pre}
      {hit && <mark className="rounded-[3px] bg-highlight px-0.5 text-ink">{hit}</mark>}
      {post}
    </>
  );
}

export function InboxView() {
  const { projectId, project, runVersion, reloadProjects } = useProject();
  const toast = useToast();
  const { m: t, fmt } = useI18n();
  const formatInt = fmt.int;
  const [kind, setKind] = useState<KindFilter>("all");
  const [source, setSource] = useState<string>("all");
  const [sentiment, setSentiment] = useState<SentimentFilter>("any");
  const [period, setPeriod] = useState<number>(7);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 300);

  const [items, setItems] = useState<MentionDTO[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /** Below xl the detail pane is a bottom sheet that opens on selection. */
  const [sheetOpen, setSheetOpen] = useState(false);
  const seen = useRef<Set<number> | null>(null);
  const ticket = useRef(0);

  const stats = useApi<StatsForCounts>(`/api/stats?projectId=${projectId}&days=${period}`);

  const filterParams = useMemo(() => {
    const p = new URLSearchParams({ projectId: String(projectId) });
    if (kind !== "all") p.set("termKind", kind);
    if (source !== "all") p.set("source", source);
    if (sentiment !== "any") p.set("sentiment", sentiment);
    if (onlyStarred) p.set("starred", "1");
    if (q) p.set("q", q);
    p.set("from", periodStart(period));
    return p;
  }, [projectId, kind, source, sentiment, onlyStarred, q, period]);

  const load = useCallback(
    async (append: boolean, after: string | null) => {
      const mine = ++ticket.current;
      const p = new URLSearchParams(filterParams);
      p.set("limit", "50");
      if (append && after) p.set("cursor", after);
      try {
        const res = await api<{ items: MentionDTO[]; nextCursor: string | null }>(`/api/mentions?${p}`);
        if (mine !== ticket.current) return;
        setItems((prev) => (append && prev ? [...prev, ...res.items] : res.items));
        setCursor(res.nextCursor);
      } catch (error) {
        if (mine === ticket.current) {
          setItems((prev) => prev ?? []);
          toast(errorText(error), "error");
        }
      } finally {
        if (mine === ticket.current) setLoadingMore(false);
      }
    },
    [filterParams, toast],
  );

  useEffect(() => {
    void load(false, null);
  }, [load, runVersion]);

  useEffect(() => {
    void stats.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runVersion]);

  // Remember which mentions were already on screen so only genuinely new ones animate in.
  const fresh = useMemo(() => {
    const result = new Set<number>();
    if (!items) return result;
    if (seen.current === null) {
      seen.current = new Set(items.map((m) => m.id));
      return result;
    }
    for (const m of items) if (!seen.current.has(m.id)) result.add(m.id);
    for (const m of items) seen.current.add(m.id);
    return result;
  }, [items]);

  const selected = items?.find((m) => m.id === selectedId) ?? items?.[0] ?? null;

  const patch = useCallback(
    async (m: MentionDTO, change: Partial<Pick<MentionDTO, "starred" | "read">>) => {
      setItems((prev) => prev?.map((x) => (x.id === m.id ? { ...x, ...change } : x)) ?? prev);
      try {
        await api(`/api/mentions/${m.id}`, { method: "PATCH", json: change });
        if (change.read !== undefined) void reloadProjects();
      } catch (error) {
        setItems((prev) => prev?.map((x) => (x.id === m.id ? { ...x, starred: m.starred, read: m.read } : x)) ?? prev);
        toast(errorText(error), "error");
      }
    },
    [reloadProjects, toast],
  );

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const select = (m: MentionDTO) => {
    setSelectedId(m.id);
    setSheetOpen(true);
    if (!m.read) void patch(m, { read: true });
  };

  const markAllRead = async () => {
    try {
      const res = await api<{ updated: number }>("/api/mentions/mark-read", { method: "POST", json: { projectId } });
      setItems((prev) => prev?.map((x) => ({ ...x, read: true })) ?? prev);
      void reloadProjects();
      toast(res.updated ? t.inbox.markedRead(formatInt(res.updated)) : t.inbox.allRead, "ok");
    } catch (error) {
      toast(errorText(error), "error");
    }
  };

  const counts = stats.data;
  const kindCount = (k: KindFilter): number | undefined => {
    if (!counts) return undefined;
    if (k === "all") return counts.totals.mentions;
    if (k === "keyword") return counts.keywordMentions;
    return counts.shareOfVoice.filter((v) => v.kind === k).reduce((a, v) => a + v.count, 0);
  };

  const enabledSourceIds = project ? Object.entries(project.sources).filter(([, s]) => s.enabled).map(([id]) => id) : [];
  const sourceIds = Array.from(new Set([...enabledSourceIds, ...Object.entries(counts?.bySource ?? {}).filter(([, n]) => n > 0).map(([id]) => id)]));

  const shownUnread = items?.filter((m) => !m.read).length ?? 0;
  const exportHref = `/api/export?${new URLSearchParams([...filterParams.entries(), ["format", "csv"]])}`;

  return (
    <>
      <PageHeader
        title={t.inbox.title}
        actions={
          <>
            <a
              href={exportHref}
              onClick={
                STATIC_DEMO
                  ? (event) => {
                      event.preventDefault();
                      void import("@/lib/demo/static-api").then(({ demoDownload }) => demoDownload(exportHref, "open-social-listening-demo.csv"));
                    }
                  : undefined
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 font-medium text-ink no-underline transition-colors hover:bg-subtle"
            >
              <Download aria-hidden="true" className="size-4" />
              {t.inbox.exportCsv}
            </a>
            <RunButton />
          </>
        }
      />
      <ProjectBanner />

      <section aria-label={t.inbox.filters} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<KindFilter>
            label={t.inbox.mentionType}
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: t.inbox.all, count: kindCount("all") },
              { value: "brand", label: t.inbox.brand, count: kindCount("brand") },
              { value: "competitor", label: t.inbox.competitors, count: kindCount("competitor") },
              { value: "keyword", label: t.inbox.topics, count: kindCount("keyword") },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex items-center">
              <span className="sr-only">{t.inbox.searchLabel}</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-ink-3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.inbox.searchPlaceholder}
                className="min-h-10 w-60 rounded-[10px] border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[13px] text-ink-3">
              {t.inbox.sentiment}
              <Select value={sentiment} onChange={(e) => setSentiment(e.target.value as SentimentFilter)}>
                <option value="any">{t.inbox.any}</option>
                <option value="positive">{t.sentiment.positive}</option>
                <option value="neutral">{t.sentiment.neutral}</option>
                <option value="negative">{t.sentiment.negative}</option>
              </Select>
            </label>
            <label className="flex items-center gap-1.5 text-[13px] text-ink-3">
              {t.inbox.period}
              <Select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                {PERIODS.map((days) => (
                  <option key={days} value={days}>
                    {t.inbox.periods[days]}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
        <div role="group" aria-label={t.inbox.source} className="flex flex-wrap gap-1.5">
          {["all", ...sourceIds].map((id) => {
            const active = source === id;
            const n = id === "all" ? counts?.totals.mentions : counts?.bySource[id];
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setSource(id)}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[9px] border text-sm font-medium transition-colors duration-150",
                  id === "all" ? "px-3" : "pr-3 pl-2",
                  active ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:bg-subtle",
                )}
              >
                {id !== "all" && <SourceBadge source={id} inverted={active} />}
                {id === "all" ? t.inbox.allSources : (t.sources[id] ?? id)}
                {n !== undefined && (
                  <>
                    {" "}
                    <span className={cn("tabular", active ? "text-white/70" : "text-ink-4")}>{formatInt(n)}</span>
                  </>
                )}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={onlyStarred}
            onClick={() => setOnlyStarred((v) => !v)}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[9px] border px-3 text-sm font-medium transition-colors duration-150",
              onlyStarred ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:bg-subtle",
            )}
          >
            <Star aria-hidden="true" className={cn("size-4", onlyStarred ? "fill-accent text-accent" : "")} />
            {t.inbox.starredFilter}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <Card aria-label={t.inbox.mentionsList} className="min-w-0 flex-[999_1_520px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-track px-4 py-3 text-[13px] text-ink-3">
            <span className="tabular">{t.inbox.listSummary(items ? formatInt(items.length) : "…", Boolean(cursor), formatInt(shownUnread))}</span>
            <button type="button" onClick={markAllRead} className="min-h-8 cursor-pointer rounded-md px-2 text-[13px] font-medium text-link hover:bg-subtle">
              {t.inbox.markAllRead}
            </button>
          </div>

          {items === null ? (
            <div className="flex flex-col">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex flex-col gap-2.5 border-b border-track px-4 py-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState title={t.inbox.emptyTitle}>
              {project && !project.lastRunAt && !project.isDemo ? t.inbox.emptyFirstRun : t.inbox.emptyFilters}
            </EmptyState>
          ) : (
            <ul className="m-0 list-none p-0">
              {items.map((m) => {
                const isSel = selected?.id === m.id;
                const metrics = metricList(m).slice(0, 2);
                const where = authorWhere(m);
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "flex items-start border-b border-track transition-colors duration-150",
                      isSel ? "bg-select" : "bg-surface hover:bg-[#fafaf8]",
                      fresh.has(m.id) && "animate-rise",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => select(m)}
                      aria-current={isSel || undefined}
                      className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 py-3.5 pr-1 pl-4 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full transition-colors", m.read ? "bg-transparent" : "bg-accent")} />
                        {!m.read && <span className="sr-only">{t.inbox.unread}</span>}
                        <SourceBadge source={m.source} size="md" />
                        <span className="truncate font-semibold">{authorName(m, t.sources)}</span>
                        {where && <span className="truncate text-ink-4">{where}</span>}
                        <span className="flex-1" />
                        <time dateTime={m.sortAt} className="shrink-0 text-[13px] text-ink-4">
                          {fmt.timeAgo(m.sortAt)}
                        </time>
                      </span>
                      <span className={cn("line-clamp-2 text-sm leading-[1.55]", m.read ? "text-ink-2" : "font-medium text-ink")}>
                        <Highlighted text={headline(m)} term={m.matchedTerm} />
                      </span>
                      <span className="flex flex-wrap items-center gap-3 text-[13px] text-ink-3">
                        <TermChip kind={m.termKind}>
                          {t.kinds[m.termKind]}: {m.competitorName ?? m.matchedTerm}
                        </TermChip>
                        <SentimentTag sentiment={m.sentiment} />
                        {metrics.length > 0 && <span className="tabular">{metrics.map((x) => t.inbox.metricCounts[x.name](fmt.compact(x.value))).join(" · ")}</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => patch(m, { starred: !m.starred })}
                      aria-label={m.starred ? t.inbox.removeStar : t.inbox.starMention}
                      aria-pressed={m.starred}
                      className="mt-2 mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-ink-4 transition-colors hover:bg-subtle hover:text-ink"
                    >
                      <Star aria-hidden="true" className={cn("size-[18px] transition-transform duration-200", m.starred && "scale-110 fill-accent text-accent")} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {cursor && (
            <div className="flex justify-center p-3">
              <Button
                variant="secondary"
                loading={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  void load(true, cursor);
                }}
              >
                {t.inbox.loadMore}
              </Button>
            </div>
          )}
        </Card>

        {sheetOpen && (
          <button
            type="button"
            aria-label={t.inbox.closeMention}
            onClick={() => setSheetOpen(false)}
            className="animate-fade-in fixed inset-0 z-30 cursor-default bg-ink/30 xl:hidden"
          />
        )}
        <Card
          as="aside"
          aria-label={t.inbox.mentionDetail}
          className={cn(
            "min-w-0 flex-col gap-[18px] p-5",
            "xl:sticky xl:top-5 xl:flex xl:flex-[1_1_340px]",
            sheetOpen
              ? "animate-rise fixed inset-x-0 bottom-0 z-40 flex max-h-[82vh] overflow-y-auto rounded-t-2xl rounded-b-none shadow-[0_-8px_32px_rgba(23,24,28,0.18)] xl:static xl:z-auto xl:max-h-none xl:overflow-visible xl:rounded-[14px] xl:shadow-none"
              : "hidden",
          )}
        >
          {sheetOpen && (
            <div className="-mt-1 flex justify-end xl:hidden">
              <Button size="sm" variant="ghost" onClick={() => setSheetOpen(false)}>
                {t.inbox.close}
              </Button>
            </div>
          )}
          {selected ? <Detail key={selected.id} m={selected} onStar={() => patch(selected, { starred: !selected.starred })} onUnread={() => patch(selected, { read: false })} /> : <p className="m-0 text-ink-3">{t.inbox.selectPrompt}</p>}
        </Card>
      </div>
    </>
  );
}

function Detail({ m, onStar, onUnread }: { m: MentionDTO; onStar: () => void; onUnread: () => void }) {
  const { m: t, fmt } = useI18n();
  const src = getSource(m.source);
  const metrics = metricList(m);
  const where = authorWhere(m);
  return (
    <div className="animate-fade-in flex flex-col gap-[18px]">
      <div className="flex items-center gap-2.5">
        {m.author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.author.avatar} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-[9px] bg-subtle object-cover" />
        ) : (
          <SourceBadge source={m.source} size="lg" />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{authorName(m, t.sources)}</span>
          <span className="truncate text-[13px] text-ink-4">
            {[t.sources[m.source] ?? m.source, where, fmt.dateTime(m.publishedAt ?? m.sortAt)].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      {m.title && m.text && <h3 className="m-0 text-base font-semibold leading-snug"><Highlighted text={m.title} term={m.matchedTerm} /></h3>}
      <p className="m-0 text-base leading-relaxed break-words whitespace-pre-line">
        <Highlighted text={m.text ?? m.title ?? ""} term={m.matchedTerm} />
      </p>
      {metrics.length > 0 && (
        <dl className="m-0 grid grid-cols-3 gap-2">
          {metrics.slice(0, 3).map((x) => (
            <div key={x.name} className="rounded-[10px] bg-bg px-3 py-2.5">
              <dt className="text-xs text-ink-3">{t.inbox.metricTitles[x.name]}</dt>
              <dd className="font-display tabular m-0 mt-0.5 text-lg font-semibold">{fmt.compact(x.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      <dl className="m-0 grid grid-cols-[110px_minmax(0,1fr)] gap-y-2.5 text-[13px]">
        <dt className="text-ink-3">{t.inbox.matched}</dt>
        <dd className="m-0">
          <TermChip kind={m.termKind}>
            {t.kinds[m.termKind]}: {m.competitorName ?? m.matchedTerm}
          </TermChip>
        </dd>
        <dt className="text-ink-3">{t.inbox.sentiment}</dt>
        <dd className="m-0">{m.sentiment ? <SentimentTag sentiment={m.sentiment} /> : <span className="text-ink-4">{t.inbox.notScored}</span>}</dd>
        {src && (
          <>
            <dt className="text-ink-3">{t.inbox.collectedVia}</dt>
            <dd className="m-0 font-mono text-xs">
              {t.inbox.perResult(src.endpoint, String(src.pricing.perResult))}
            </dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-ink px-4 font-semibold text-white no-underline transition-colors hover:bg-ink-2">
          {t.inbox.openOriginal}
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
        <Button variant="secondary" onClick={onStar} icon={<Star aria-hidden="true" className={cn("size-4", m.starred && "fill-accent text-accent")} />}>
          {m.starred ? t.inbox.starred : t.inbox.star}
        </Button>
        <Button variant="secondary" onClick={onUnread} disabled={!m.read}>
          {t.inbox.markUnread}
        </Button>
      </div>
    </div>
  );
}
