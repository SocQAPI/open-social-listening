"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { api, errorText, useApi } from "@/lib/ui/api";
import { cn } from "@/lib/ui/cn";
import { useI18n } from "@/lib/i18n";
import { creditsToUsd } from "@/lib/ui/format";
import { INTERVALS, SOURCES, defaultSources, draftEstimate, searchCost, suggestedBudget, toCompetitors, type ProjectDraft } from "@/lib/ui/draft";
import { Button } from "@/components/ui/button";
import { CountUp, Field, Notice, Skeleton, TextInput } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { BroadTermNotice, TermEditor } from "@/components/ui/term-editor";
import { useToast } from "@/components/ui/toast";
import { Logo } from "@/components/shell/logo";
import { LanguageSelect } from "@/components/shell/sidebar";
import type { SettingsSnapshot } from "@/components/shell/project-context";

const SIGNUP_URL = "https://socq.ai/dashboard/api-key?utm_source=open-social-listening&utm_medium=app&utm_campaign=onboarding";

export function OnboardingView() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { m: t, fmt } = useI18n();
  const o = t.onboarding;
  const p = t.project;
  const formatInt = fmt.int;
  const settings = useApi<SettingsSnapshot>("/api/settings");
  const projects = useApi<{ items: { id: number; isDemo: boolean }[] }>("/api/projects");

  const [step, setStepState] = useState(1);
  /** Which way the last step change went, so the next card slides in from the matching side. */
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const setStep = (next: number) => {
    setDirection(next >= step ? "forward" : "back");
    setStepState(next);
  };
  const slide = direction === "forward" ? "animate-slide-in-right" : "animate-slide-in-left";
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft>({
    name: "",
    brandTerms: [],
    competitorNames: [],
    keywords: [],
    excludeTerms: [],
    sources: defaultSources(),
    intervalMinutes: 1440,
    monthlyBudgetCredits: 0,
  });

  const configured = settings.data?.apiKey.configured ?? false;

  // With a key already in place when the page opens, skip straight to the project.
  // A key connected on this page stays on step 1 so the confirmation and balance are visible.
  const connectedHere = useRef(false);
  useEffect(() => {
    if (configured && step === 1 && !connectedHere.current) setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  const estimate = draftEstimate(draft);
  const budget = budgetTouched ? draft.monthlyBudgetCredits : suggestedBudget(estimate.perMonth);
  const update = (patch: Partial<ProjectDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const hasRealProject = projects.data?.items.some((p) => !p.isDemo) ?? false;
  const trackedCount = draft.brandTerms.length + draft.competitorNames.length + draft.keywords.length;
  const enabledCount = Object.values(draft.sources).filter((s) => s.enabled).length;

  const connect = async () => {
    setChecking(true);
    try {
      const res = await api<{ account: { credits: number | null } | null }>("/api/settings", { method: "PUT", json: { apiKey: key.trim() } });
      setBalance(res.account?.credits ?? null);
      connectedHere.current = true;
      await settings.reload();
      setKey("");
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setChecking(false);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const name = draft.name.trim() || draft.brandTerms[0] || o.defaultName;
      const project = await api<{ id: number }>("/api/projects", {
        method: "POST",
        json: {
          name,
          brandTerms: draft.brandTerms,
          keywords: draft.keywords,
          competitors: toCompetitors(draft.competitorNames),
          excludeTerms: draft.excludeTerms,
          sources: draft.sources,
          intervalMinutes: draft.intervalMinutes,
          monthlyBudgetCredits: budget,
        },
      });
      try {
        await api(`/api/projects/${project.id}/run`, { method: "POST" });
      } catch {
        /* the schedule will pick it up; the inbox explains an empty state */
      }
      router.replace(`/p/${project.id}/inbox`);
    } catch (error) {
      toast(errorText(error), "error");
      setCreating(false);
    }
  };

  const fromEnv = settings.data?.apiKey.source === "env";
  const isNew = params.get("new") === "1";

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg/85 px-5 py-[18px] backdrop-blur-md sm:px-8">
        <Logo />
        <div className="flex flex-wrap items-center gap-4">
          {(isNew || hasRealProject || projects.data?.items.length) ? (
            <Link href="/" className="group inline-flex items-center gap-1 font-medium no-underline hover:underline">
              <ArrowLeft aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              {hasRealProject ? o.backToProjects : o.exploreDemo}
            </Link>
          ) : null}
          <LanguageSelect />
        </div>
      </header>

      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-5 pt-10 pb-16 sm:px-6">
        <div className="animate-rise flex flex-col gap-1.5">
          <h1 className="font-display m-0 text-[32px] font-semibold tracking-[-0.02em]">{hasRealProject ? o.titleNew : o.titleFirst}</h1>
          <p className="m-0 text-[15px] text-ink-3">{o.intro}</p>
        </div>

        <ol aria-label={o.stepsLabel} className="animate-rise m-0 grid list-none grid-cols-3 gap-2 p-0 [animation-delay:60ms]">
          {o.steps.map((label, i) => {
            const n = i + 1;
            const reached = n <= step;
            const done = n < step;
            return (
              <li key={label} aria-current={n === step ? "step" : undefined} className="flex flex-col gap-2.5">
                <span className="h-1 overflow-hidden rounded-full bg-line-strong">
                  <span
                    className={cn("block h-full rounded-full bg-accent transition-[width] duration-500 ease-out", reached ? "w-full" : "w-0")}
                    // Moving forward, the bar fills after the previous one; moving back, it empties at once.
                    style={{ transitionDelay: reached && direction === "forward" ? "120ms" : "0ms" }}
                  />
                </span>
                <span className={cn("flex items-center gap-2 text-[13px] transition-colors duration-300", n === step ? "font-semibold text-ink" : reached ? "font-medium text-ink" : "font-medium text-ink-4")}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-[background-color,color,box-shadow] duration-300",
                      done ? "bg-ink text-white" : n === step ? "bg-accent-strong text-white shadow-[0_0_0_4px_var(--color-accent-tint)]" : "bg-track text-ink-4",
                    )}
                  >
                    {done ? <Check key="done" className="animate-pop-in size-3" strokeWidth={3} /> : n}
                  </span>
                  <span className="min-w-0 leading-snug">{label}</span>
                </span>
              </li>
            );
          })}
        </ol>

        {settings.data === null ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : step === 1 ? (
          <section key="s1" aria-labelledby="s1" className={cn(slide, "flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(23,24,28,0.04),0_8px_28px_rgba(23,24,28,0.05)] sm:p-7")}>
            <div className="flex flex-col gap-1.5">
              <h2 id="s1" className="m-0 text-xl font-semibold">
                {o.connectTitle}
              </h2>
              <p className="m-0 text-ink-2">{o.connectIntro}</p>
            </div>
            {configured ? (
              <Notice tone="info">
                <span className="inline-flex items-center gap-2">
                  <Check aria-hidden="true" className="animate-pop-in size-4" strokeWidth={2.4} />
                  {balance !== null ? (
                    <span>
                      {o.connectedBalance(formatInt(balance), creditsToUsd(balance))}
                    </span>
                  ) : (
                    o.connected
                  )}
                </span>
              </Notice>
            ) : (
              <Field label={o.keyLabel}>
                <TextInput
                  mono
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && key.trim().length >= 8) void connect();
                  }}
                  placeholder={o.keyPlaceholder}
                  className="min-h-12"
                />
              </Field>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href={SIGNUP_URL} target="_blank" rel="noopener" className="group inline-flex items-center gap-1 font-medium no-underline hover:underline">
                {o.noKey}
                <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
              {configured ? (
                <Button size="lg" variant="primary" onClick={() => setStep(2)}>
                  {o.continue}
                  <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              ) : (
                <Button size="lg" variant="primary" onClick={connect} loading={checking} disabled={key.trim().length < 8 || fromEnv}>
                  {o.testConnection}
                </Button>
              )}
            </div>
          </section>
        ) : step === 2 ? (
          <section key="s2" aria-labelledby="s2" className={cn(slide, "flex flex-col gap-[22px] rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(23,24,28,0.04),0_8px_28px_rgba(23,24,28,0.05)] sm:p-7")}>
            <div className="flex flex-col gap-1.5">
              <h2 id="s2" className="m-0 text-xl font-semibold">
                {o.trackTitle}
              </h2>
              <p className="m-0 text-ink-2">{o.trackIntro}</p>
            </div>
            <Field label={p.name} className="max-w-md">
              <TextInput value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder={o.namePlaceholder} maxLength={80} />
            </Field>
            <TermEditor kind="brand" title={p.brandTitle} hint={o.brandHint} values={draft.brandTerms} onChange={(v) => update({ brandTerms: v, name: draft.name || v[0] || "" })} placeholder={o.brandPlaceholder} />
            <TermEditor kind="competitor" title={p.competitorsTitle} hint={o.competitorsHint} values={draft.competitorNames} onChange={(v) => update({ competitorNames: v })} placeholder={p.competitorPlaceholder} max={10} />
            <BroadTermNotice terms={[...draft.brandTerms, ...draft.competitorNames]} excludeTitle={p.excludeTitle} />
            <TermEditor kind="keyword" title={p.topicsTitle} hint={p.topicsHint} values={draft.keywords} onChange={(v) => update({ keywords: v })} placeholder={o.topicsPlaceholder} />
            <TermEditor kind="exclude" title={p.excludeTitle} hint={p.excludeHint} values={draft.excludeTerms} onChange={(v) => update({ excludeTerms: v })} placeholder={p.excludePlaceholder} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button size="lg" variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                {o.back}
              </Button>
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="tabular text-ink-3">{p.searchesPerRun(estimate.searches)}</span>
                <Button size="lg" variant="primary" onClick={() => setStep(3)} disabled={trackedCount === 0}>
                  {o.continue}
                  <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section key="s3" aria-labelledby="s3" className={cn(slide, "flex flex-col gap-[22px] rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(23,24,28,0.04),0_8px_28px_rgba(23,24,28,0.05)] sm:p-7")}>
            <div className="flex flex-col gap-1.5">
              <h2 id="s3" className="m-0 text-xl font-semibold">
                {o.sourcesTitle}
              </h2>
              <p className="m-0 text-ink-2">{o.sourcesIntro}</p>
            </div>
            <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 border-0 p-0">
              <legend className="mb-2.5 p-0 font-medium">{p.sources}</legend>
              {SOURCES.map((src) => {
                const cfg = draft.sources[src.id];
                const on = cfg?.enabled ?? false;
                return (
                  <label
                    key={src.id}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98]",
                      "has-[:focus-visible]:shadow-[0_0_0_3px_var(--color-accent-tint)]",
                      on ? "border-ink bg-surface shadow-[0_2px_8px_rgba(23,24,28,0.08)]" : "border-line bg-[#fafaf8] hover:border-line-strong hover:bg-surface",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => update({ sources: { ...draft.sources, [src.id]: { ...cfg, enabled: !on } } })}
                      className="peer sr-only"
                    />
                    {/* The visible box; the real checkbox above stays for keyboards and screen readers. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,border-color] duration-200",
                        on ? "border-ink bg-ink text-white" : "border-input bg-surface",
                      )}
                    >
                      {on && <Check className="animate-pop-in size-3" strokeWidth={3.2} />}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{t.sourceNames[src.id] ?? src.label}</span>
                      <span className="font-mono text-[11px] text-ink-3">{src.endpoint}</span>
                    </span>
                    <span className="tabular text-[13px] text-ink-2">{t.common.credits(String(searchCost(src, cfg?.resultsLimit ?? src.limits.default)))}</span>
                  </label>
                );
              })}
            </fieldset>

            <div className="flex flex-wrap items-end gap-5">
              <div className="flex flex-col gap-2">
                <span className="font-medium">{p.howOften}</span>
                <Segmented<number> label={p.runFrequency} value={draft.intervalMinutes} onChange={(v) => update({ intervalMinutes: v })} options={INTERVALS.map((i) => ({ value: i.value, label: t.intervals[i.value] ?? i.label }))} />
              </div>
              <Field label={p.monthlyBudget}>
                <TextInput
                  type="number"
                  min={0}
                  step={500}
                  value={budget}
                  onChange={(e) => {
                    setBudgetTouched(true);
                    update({ monthlyBudgetCredits: Number(e.target.value) || 0 });
                  }}
                  className="w-44 tabular"
                />
              </Field>
            </div>

            <div aria-live="polite" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 rounded-[14px] bg-bg px-5 py-[18px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-ink-3">{p.perRun}</span>
                <span className="font-display tabular text-2xl font-semibold">
                  <CountUp value={estimate.perRun} format={fmt.credits} duration={450} />
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-ink-3">{p.perMonth}</span>
                <span className="font-display tabular text-2xl font-semibold">
                  <CountUp value={estimate.perMonth} format={fmt.credits} duration={450} />
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-ink-3">{p.about}</span>
                <span className="font-display tabular text-2xl font-semibold">
                  <CountUp value={estimate.perMonth} format={(n) => p.usdPerMonth(creditsToUsd(n))} duration={450} />
                </span>
              </div>
              <p className="col-span-full m-0 text-[13px] text-ink-3">{p.upperBound(budget === 0)}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button size="lg" variant="secondary" onClick={() => setStep(2)}>
                <ArrowLeft aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                {o.back}
              </Button>
              <Button size="lg" variant="primary" onClick={create} loading={creating} disabled={enabledCount === 0}>
                {o.start}
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
