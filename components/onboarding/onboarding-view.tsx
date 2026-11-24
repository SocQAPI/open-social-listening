"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { api, errorText, useApi } from "@/lib/ui/api";
import { cn } from "@/lib/ui/cn";
import { creditsToUsd, formatInt } from "@/lib/ui/format";
import { INTERVALS, SOURCES, defaultSources, draftEstimate, searchCost, suggestedBudget, toCompetitors, type ProjectDraft } from "@/lib/ui/draft";
import { Button } from "@/components/ui/button";
import { Field, Notice, Skeleton, TextInput } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { TermEditor } from "@/components/ui/term-editor";
import { useToast } from "@/components/ui/toast";
import { Logo } from "@/components/shell/logo";
import type { SettingsSnapshot } from "@/components/shell/project-context";

const SIGNUP_URL = "https://socq.ai/dashboard/api-key?utm_source=open-social-listening&utm_medium=app&utm_campaign=onboarding";
const STEPS = ["Connect SocQ", "What to track", "Sources and budget"];

export function OnboardingView() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const settings = useApi<SettingsSnapshot>("/api/settings");
  const projects = useApi<{ items: { id: number; isDemo: boolean }[] }>("/api/projects");

  const [step, setStep] = useState(1);
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
      const name = draft.name.trim() || draft.brandTerms[0] || "My brand";
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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-[18px] sm:px-8">
        <Logo />
        {(isNew || hasRealProject || projects.data?.items.length) ? (
          <Link href="/" className="font-medium">
            {hasRealProject ? "Back to my projects" : "Explore with demo data instead"}
          </Link>
        ) : null}
      </header>

      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-5 pt-10 pb-16 sm:px-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display m-0 text-[32px] font-semibold tracking-[-0.02em]">{hasRealProject ? "Set up a new project" : "Set up your first project"}</h1>
          <p className="m-0 text-[15px] text-ink-3">Three steps, about two minutes. You can change everything later in Settings.</p>
        </div>

        <ol aria-label="Steps" className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const reached = n <= step;
            return (
              <li key={label} aria-current={n === step ? "step" : undefined} className="flex flex-col gap-2">
                <span className="h-1 overflow-hidden rounded-full bg-line-strong">
                  <span className={cn("block h-full rounded-full bg-accent transition-[width] duration-500 ease-out", reached ? "w-full" : "w-0")} />
                </span>
                <span className={cn("text-[13px]", n === step ? "font-semibold text-ink" : reached ? "font-medium text-ink" : "font-medium text-ink-4")}>
                  {n}. {label}
                </span>
              </li>
            );
          })}
        </ol>

        {settings.data === null ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : step === 1 ? (
          <section key="s1" aria-labelledby="s1" className="animate-rise flex flex-col gap-5 rounded-2xl border border-line bg-surface p-7">
            <div className="flex flex-col gap-1.5">
              <h2 id="s1" className="m-0 text-xl font-semibold">
                Connect your SocQ account
              </h2>
              <p className="m-0 text-ink-2">
                Open Social Listening is free and MIT licensed. It collects public posts through the SocQ API, so you only pay SocQ for the results you fetch. Your key is stored on this server and sent nowhere else.
              </p>
            </div>
            {configured ? (
              <Notice tone="info">
                <span className="inline-flex items-center gap-2">
                  <Check aria-hidden="true" className="size-4" strokeWidth={2.4} />
                  Connected{balance !== null ? <>. Balance: <strong>{formatInt(balance)} credits</strong> (about {creditsToUsd(balance)}).</> : "."}
                </span>
              </Notice>
            ) : (
              <Field label="SocQ API key">
                <TextInput
                  mono
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && key.trim().length >= 8) void connect();
                  }}
                  placeholder="Paste the key from your SocQ dashboard"
                  className="min-h-12"
                />
              </Field>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href={SIGNUP_URL} target="_blank" rel="noopener" className="font-medium">
                No key yet? Create a free SocQ account
              </a>
              {configured ? (
                <Button size="lg" variant="primary" onClick={() => setStep(2)} icon={<ArrowRight aria-hidden="true" className="size-4" />}>
                  Continue
                </Button>
              ) : (
                <Button size="lg" variant="primary" onClick={connect} loading={checking} disabled={key.trim().length < 8 || fromEnv}>
                  Test connection
                </Button>
              )}
            </div>
          </section>
        ) : step === 2 ? (
          <section key="s2" aria-labelledby="s2" className="animate-rise flex flex-col gap-[22px] rounded-2xl border border-line bg-surface p-7">
            <div className="flex flex-col gap-1.5">
              <h2 id="s2" className="m-0 text-xl font-semibold">
                What should we listen for?
              </h2>
              <p className="m-0 text-ink-2">Every term becomes one search per source on each run, so fewer, sharper terms cost less.</p>
            </div>
            <Field label="Project name" className="max-w-md">
              <TextInput value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="Usually your brand" maxLength={80} />
            </Field>
            <TermEditor kind="brand" title="Your brand" hint="Names and handles people use for you. Press Enter after each." values={draft.brandTerms} onChange={(v) => update({ brandTerms: v, name: draft.name || v[0] || "" })} placeholder="e.g. Acme Notes" />
            <TermEditor kind="competitor" title="Competitors" hint="Tracked separately so you can compare share of voice." values={draft.competitorNames} onChange={(v) => update({ competitorNames: v })} placeholder="Competitor name" max={10} />
            <TermEditor kind="keyword" title="Topics" hint="Category words where buyers ask for recommendations." values={draft.keywords} onChange={(v) => update({ keywords: v })} placeholder="e.g. markdown notes app" />
            <TermEditor kind="exclude" title="Ignore posts containing" hint="Filters out look-alike names. Not searched, so free." values={draft.excludeTerms} onChange={(v) => update({ excludeTerms: v })} placeholder="Word to ignore" />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button size="lg" variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="tabular text-ink-3">
                  {estimate.searches} search{estimate.searches === 1 ? "" : "es"} per source per run
                </span>
                <Button size="lg" variant="primary" onClick={() => setStep(3)} disabled={trackedCount === 0} icon={<ArrowRight aria-hidden="true" className="size-4" />}>
                  Continue
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section key="s3" aria-labelledby="s3" className="animate-rise flex flex-col gap-[22px] rounded-2xl border border-line bg-surface p-7">
            <div className="flex flex-col gap-1.5">
              <h2 id="s3" className="m-0 text-xl font-semibold">
                Sources, schedule and budget
              </h2>
              <p className="m-0 text-ink-2">Prices are SocQ list prices per search at the default result count. The estimate updates as you change things.</p>
            </div>
            <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 border-0 p-0">
              <legend className="mb-2.5 p-0 font-medium">Sources</legend>
              {SOURCES.map((src) => {
                const cfg = draft.sources[src.id];
                const on = cfg?.enabled ?? false;
                return (
                  <label
                    key={src.id}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2 transition-[border-color,background-color] duration-150",
                      on ? "border-ink bg-surface" : "border-line bg-[#fafaf8] hover:border-line-strong",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => update({ sources: { ...draft.sources, [src.id]: { ...cfg, enabled: !on } } })}
                      className="size-[18px] accent-ink"
                    />
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{src.label}</span>
                      <span className="font-mono text-[11px] text-ink-3">{src.endpoint}</span>
                    </span>
                    <span className="tabular text-[13px] text-ink-2">{searchCost(src, cfg?.resultsLimit ?? src.limits.default)} cr</span>
                  </label>
                );
              })}
            </fieldset>

            <div className="flex flex-wrap items-end gap-5">
              <div className="flex flex-col gap-2">
                <span className="font-medium">How often</span>
                <Segmented<number> label="Run frequency" value={draft.intervalMinutes} onChange={(v) => update({ intervalMinutes: v })} options={INTERVALS.map((i) => ({ value: i.value, label: i.label }))} />
              </div>
              <Field label="Monthly budget (credits)">
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
                <span className="text-[13px] text-ink-3">Per run</span>
                <span className="font-display tabular text-2xl font-semibold">{formatInt(estimate.perRun)} cr</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-ink-3">Per month</span>
                <span className="font-display tabular text-2xl font-semibold">{formatInt(estimate.perMonth)} cr</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-ink-3">About</span>
                <span className="font-display tabular text-2xl font-semibold">{creditsToUsd(estimate.perMonth)} / mo</span>
              </div>
              <p className="col-span-full m-0 text-[13px] text-ink-3">
                Upper bound: SocQ bills only results that come back, and each run asks for recent posts and skips the ones you already have. Runs pause on their own before the month goes over budget
                {budget === 0 ? " (0 means no limit)" : ""}.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button size="lg" variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button size="lg" variant="primary" onClick={create} loading={creating} disabled={enabledCount === 0}>
                Start listening · first run now
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
