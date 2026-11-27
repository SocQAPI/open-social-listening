"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, Search, SearchX, Star } from "lucide-react";
import { STATIC_DEMO } from "@/lib/demo/static";
import type { MentionDTO } from "@/lib/dto";
import { getSource } from "@/lib/sources";
import { api, errorText, useApi, useDebounced } from "@/lib/ui/api";
import { cn } from "@/lib/ui/cn";
import { useI18n, type Messages } from "@/lib/i18n";
import { splitHighlight } from "@/lib/ui/format";
import { Button } from "@/components/ui/button";
import { Card, Dropdown, EmptyState, Skeleton } from "@/components/ui/primitives";
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
  /** Bumped when a different filter's results arrive; the list is re-keyed so its rows cascade in again. */
  const [listVersion, setListVersion] = useState(0);
  const lastFilters = useRef<string | null>(null);
  /** Rows cascade in only while a list is first shown; after that only rows a run adds animate. */
  const [cascadeVersion, setCascadeVersion] = useState(0);

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
        const filters = filterParams.toString();
        if (!append && lastFilters.current !== filters) {
          if (seen.current) seen.current = new Set([...seen.current, ...res.items.map((m) => m.id)]);
          setListVersion((v) => v + 1);
        }
        if (!append) lastFilters.current = filters;
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

  // Once the cascade has played (14 rows × 28ms plus the 240ms rise), stop it, so starring or reading a row
  // later does not replay it.
  useEffect(() => {
    if (cascadeVersion === listVersion) return;
    const timer = window.setTimeout(() => setCascadeVersion(listVersion), 14 * 28 + 300);
    return () => window.clearTimeout(timer);
  }, [listVersion, cascadeVersion]);

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
              className="group inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 font-medium text-ink no-underline transition-[background-color,transform] duration-150 hover:bg-subtle active:scale-[0.98]"
            >
              <Download aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-y-0.5" />
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
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="group relative flex w-full items-center sm:w-auto">
              <span className="sr-only">{t.inbox.searchLabel}</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-ink-3 transition-colors group-focus-within:text-ink" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.inbox.searchPlaceholder}
                className="min-h-10 w-full rounded-[10px] border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink transition-[border-color,box-shadow,width] duration-200 ease-out placeholder:text-ink-4 hover:border-input focus:border-ink focus:shadow-[0_0_0_3px_var(--color-accent-tint)] focus:outline-none sm:w-56 sm:focus:w-72"
              />
            </label>
            <Dropdown<SentimentFilter>
              label={t.inbox.sentiment}
              showLabel
              value={sentiment}
              onChange={setSentiment}
              align="end"
              className="flex-1 sm:flex-none"
              options={[
                { value: "any", label: t.inbox.any },
                { value: "positive", label: t.sentiment.positive, dot: "bg-pos" },
                { value: "neutral", label: t.sentiment.neutral, dot: "bg-neu" },
                { value: "negative", label: t.sentiment.negative, dot: "bg-neg" },
              ]}
            />
            <Dropdown<number>
              label={t.inbox.period}
              showLabel
              value={period}
              onChange={setPeriod}
              align="end"
              className="flex-1 sm:flex-none"
              options={PERIODS.map((days) => ({ value: days, label: t.inbox.periods[days] }))}
            />
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
                  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[9px] border text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.96]",
                  id === "all" ? "px-3" : "pr-3 pl-2",
                  active ? "border-ink bg-ink text-white shadow-[0_2px_8px_rgba(23,24,28,0.18)]" : "border-line-strong bg-surface text-ink hover:border-input hover:bg-subtle",
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
              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[9px] border px-3 text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.96]",
              onlyStarred ? "border-ink bg-ink text-white shadow-[0_2px_8px_rgba(23,24,28,0.18)]" : "border-line-strong bg-surface text-ink hover:border-input hover:bg-subtle",
            )}
          >
            <Star aria-hidden="true" className={cn("size-4", onlyStarred && "animate-pop-in fill-accent text-accent")} />
            {t.inbox.starredFilter}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <Card aria-label={t.inbox.mentionsList} className="min-w-0 flex-[999_1_520px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-track px-4 py-3 text-[13px] text-ink-3">
            <span className="tabular">{t.inbox.listSummary(items ? formatInt(items.length) : "…", Boolean(cursor), formatInt(shownUnread))}</span>
            <button
              type="button"
              onClick={markAllRead}
              disabled={shownUnread === 0}
              className="min-h-8 cursor-pointer rounded-md px-2 text-[13px] font-medium text-link transition-[background-color,opacity] hover:bg-subtle disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
            >
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
            <EmptyState title={t.inbox.emptyTitle} icon={project && !project.lastRunAt && !project.isDemo ? undefined : <SearchX className="size-[22px]" strokeWidth={1.8} />}>
              {project && !project.lastRunAt && !project.isDemo ? t.inbox.emptyFirstRun : t.inbox.emptyFilters}
            </EmptyState>
          ) : (
            <ul key={listVersion} className="m-0 list-none p-0">
              {items.map((m, i) => {
                const isSel = selected?.id === m.id;
                const metrics = metricList(m).slice(0, 2);
                const where = authorWhere(m);
                // The first rows cascade in when a list is shown; rows a run adds later rise on their own.
                const cascade = cascadeVersion !== listVersion && i < 14;
                return (
                  <li
                    key={m.id}
                    style={cascade ? { animationDelay: `${i * 28}ms` } : undefined}
                    className={cn(
                      "relative flex items-start border-b border-track transition-colors duration-150",
                      isSel ? "bg-select" : "bg-surface hover:bg-[#fafaf8]",
                      (cascade || fresh.has(m.id)) && "animate-rise",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-y-0 left-0 w-[3px] rounded-r bg-brand transition-transform duration-300 ease-out",
                        isSel ? "scale-y-100" : "scale-y-0",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => select(m)}
                      aria-current={isSel || undefined}
                      className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 py-3.5 pr-1 pl-4 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full transition-[background-color,transform] duration-300", m.read ? "scale-50 bg-transparent" : "bg-accent")} />
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
                      className="group mt-2 mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-ink-4 transition-[background-color,color,transform] hover:bg-subtle hover:text-ink active:scale-90"
                    >
                      <Star
                        aria-hidden="true"
                        className={cn("size-[18px] transition-transform duration-200", m.starred ? "animate-pop-in fill-accent text-accent" : "group-hover:-rotate-12")}
                      />
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
            className="animate-fade-in fixed inset-0 z-30 cursor-default bg-ink/30 backdrop-blur-[2px] xl:hidden"
          />
        )}
        <Card
          as="aside"
          aria-label={t.inbox.mentionDetail}
          className={cn(
            "min-w-0 flex-col gap-[18px] p-5",
            "xl:sticky xl:top-5 xl:flex xl:flex-[1_1_340px]",
            sheetOpen
              ? "max-xl:animate-sheet-up fixed inset-x-0 bottom-0 z-40 flex max-h-[82vh] overflow-y-auto rounded-t-2xl rounded-b-none shadow-[0_-8px_32px_rgba(23,24,28,0.18)] xl:static xl:z-auto xl:max-h-none xl:overflow-visible xl:rounded-[14px] xl:shadow-[0_1px_2px_rgba(23,24,28,0.04)]"
              : "hidden",
          )}
        >
          {sheetOpen && (
            <div className="relative -mt-1 flex justify-end xl:hidden">
              <span aria-hidden="true" className="absolute top-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong" />
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
    <div className="animate-slide-in-right flex flex-col gap-[18px]">
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
            <div key={x.name} className="rounded-[10px] border border-track bg-bg px-3 py-2.5 transition-colors hover:border-line-strong">
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
        <a
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-ink px-4 font-semibold text-white no-underline shadow-[0_1px_2px_rgba(23,24,28,0.2)] transition-[background-color,box-shadow,transform] duration-150 hover:bg-ink-2 hover:shadow-[0_4px_12px_rgba(23,24,28,0.18)] active:scale-[0.98]"
        >
          {t.inbox.openOriginal}
          <ExternalLink aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
        <Button variant="secondary" onClick={onStar} icon={<Star aria-hidden="true" className={cn("size-4", m.starred && "animate-pop-in fill-accent text-accent")} />}>
          {m.starred ? t.inbox.starred : t.inbox.star}
        </Button>
        <Button variant="secondary" onClick={onUnread} disabled={!m.read}>
          {t.inbox.markUnread}
        </Button>
      </div>
    </div>
  );
}
