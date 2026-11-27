"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Pause, Play } from "lucide-react";
import { api, errorText, useApi } from "@/lib/ui/api";
import { cn } from "@/lib/ui/cn";
import { useI18n } from "@/lib/i18n";
import { creditsToUsd } from "@/lib/ui/format";
import { INTERVALS, SOURCES, draftEstimate, limitOptions, searchCost, suggestedBudget, toCompetitors, type ProjectDraft } from "@/lib/ui/draft";
import { Button } from "@/components/ui/button";
import { Card, Field, Meter, Notice, Select, Skeleton, Switch, TextInput } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { BroadTermNotice, TermEditor } from "@/components/ui/term-editor";
import { useToast } from "@/components/ui/toast";
import { ProjectBanner, ProjectStatusLine } from "@/components/shell/page-header";
import { useProject, type ProjectWithCounts } from "@/components/shell/project-context";

function toDraft(p: ProjectWithCounts): ProjectDraft {
  return {
    name: p.name,
    brandTerms: [...p.brandTerms],
    competitorNames: p.competitors.map((c) => c.name),
    keywords: [...p.keywords],
    excludeTerms: [...p.excludeTerms],
    sources: Object.fromEntries(Object.entries(p.sources).map(([id, s]) => [id, { ...s }])),
    intervalMinutes: p.intervalMinutes,
    monthlyBudgetCredits: p.monthlyBudgetCredits,
  };
}

function Section({ id, title, meta, children, className }: { id: string; title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card aria-labelledby={id} className={cn("flex flex-col gap-4 px-[22px] py-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="m-0 text-base font-semibold">
          {title}
        </h2>
        {meta && <span className="text-[13px] text-ink-3">{meta}</span>}
      </div>
      {children}
    </Card>
  );
}

export function SettingsView() {
  const { projectId, project, reloadProjects, monthUsed } = useProject();
  const toast = useToast();
  const { m: t, fmt } = useI18n();
  const st = t.settings;
  const p = t.project;
  const formatInt = fmt.int;
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project && draft === null) setDraft(toDraft(project));
  }, [project, draft]);

  const original = useMemo(() => (project ? JSON.stringify(toDraft(project)) : ""), [project]);
  const dirty = draft !== null && JSON.stringify(draft) !== original;
  const estimate = draft ? draftEstimate(draft) : null;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!project || !draft || !estimate) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
        <Skeleton className="h-72 w-full rounded-[14px]" />
      </div>
    );
  }

  const update = (patch: Partial<ProjectDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setSource = (id: string, patch: Partial<{ enabled: boolean; resultsLimit: number }>) =>
    setDraft((d) => (d ? { ...d, sources: { ...d.sources, [id]: { ...d.sources[id], ...patch } } } : d));

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.brandTerms.length && !draft.keywords.length && !draft.competitorNames.length) {
      toast(st.needOneTerm, "error");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/projects/${projectId}`, {
        method: "PATCH",
        json: {
          name: draft.name.trim() || project.name,
          brandTerms: draft.brandTerms,
          keywords: draft.keywords,
          competitors: toCompetitors(draft.competitorNames, project.competitors),
          excludeTerms: draft.excludeTerms,
          sources: draft.sources,
          intervalMinutes: draft.intervalMinutes,
          monthlyBudgetCredits: Math.max(0, Math.round(draft.monthlyBudgetCredits)),
        },
      });
      await reloadProjects();
      setDraft(null); // re-seed from the saved project
      toast(st.saved, "ok");
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async () => {
    try {
      await api(`/api/projects/${projectId}`, { method: "PATCH", json: { paused: !project.paused } });
      await reloadProjects();
      toast(project.paused ? st.resumed : st.pausedToast, "ok");
    } catch (error) {
      toast(errorText(error), "error");
    }
  };

  const budget = draft.monthlyBudgetCredits;
  const overBudget = budget > 0 && estimate.perMonth > budget;

  return (
    <div className="flex max-w-[1080px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display m-0 text-[28px] font-semibold tracking-[-0.02em]">{st.title}</h1>
          <p className="m-0 text-ink-3">
            <ProjectStatusLine /> · {st.applyNextRun}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!project.isDemo && (
            <Button variant="secondary" onClick={togglePause} icon={project.paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}>
              {project.paused ? st.resume : st.pause}
            </Button>
          )}
          <Button type="submit" form="project-settings" variant={dirty || saving ? "primary" : "secondary"} loading={saving} disabled={!dirty} icon={<Check aria-hidden="true" className="size-4" />}>
            {dirty ? st.saveChanges : st.savedState}
          </Button>
        </div>
      </header>
      <ProjectBanner />

      <form id="project-settings" onSubmit={save} className="flex flex-col gap-5">
      <Section id="tracking" title={st.tracking} meta={p.searchesPerRun(estimate.searches)}>
        <Field label={p.name} className="max-w-md">
          <TextInput value={draft.name} onChange={(e) => update({ name: e.target.value })} maxLength={80} />
        </Field>
        <TermEditor kind="brand" title={p.brandTitle} hint={st.brandHint} values={draft.brandTerms} onChange={(v) => update({ brandTerms: v })} placeholder={st.brandPlaceholder} />
        <TermEditor
          kind="competitor"
          title={p.competitorsTitle}
          hint={st.competitorsHint}
          values={draft.competitorNames}
          onChange={(v) => update({ competitorNames: v })}
          placeholder={p.competitorPlaceholder}
          max={10}
        />
        <BroadTermNotice terms={[...draft.brandTerms, ...draft.competitorNames]} excludeTitle={p.excludeTitle} />
        <TermEditor kind="keyword" title={p.topicsTitle} hint={p.topicsHint} values={draft.keywords} onChange={(v) => update({ keywords: v })} placeholder={st.topicsPlaceholder} />
        <TermEditor
          kind="exclude"
          title={p.excludeTitle}
          hint={p.excludeHint}
          values={draft.excludeTerms}
          onChange={(v) => update({ excludeTerms: v })}
          placeholder={p.excludePlaceholder}
        />
      </Section>

      <Section id="sources" title={p.sources} meta={st.sourcesMeta}>
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="w-16 py-2 font-medium">{st.colOn}</th>
                <th scope="col" className="py-2 font-medium">{st.colSource}</th>
                <th scope="col" className="py-2 font-medium">{st.colEndpoint}</th>
                <th scope="col" className="py-2 font-medium">{st.colResults}</th>
                <th scope="col" className="py-2 text-right font-medium">{st.colPerSearch}</th>
                <th scope="col" className="py-2 text-right font-medium">{p.perMonth}</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((src) => {
                const cfg = draft.sources[src.id] ?? { enabled: false, resultsLimit: src.limits.default };
                const cost = searchCost(src, cfg.resultsLimit);
                const label = t.sourceNames[src.id] ?? src.label;
                return (
                  <tr key={src.id} className="border-t border-track">
                    <td className="py-2">
                      <Switch checked={cfg.enabled} onChange={(v) => setSource(src.id, { enabled: v })} label={st.sourceToggle(label)} />
                    </td>
                    <td className={cn("py-2 font-medium", !cfg.enabled && "text-ink-4")}>{label}</td>
                    <td className="py-2 font-mono text-xs text-ink-3">{src.endpoint}</td>
                    <td className="py-2">
                      {src.supportsResultsLimit ? (
                        <Select aria-label={st.resultsOn(label)} value={cfg.resultsLimit} onChange={(e) => setSource(src.id, { resultsLimit: Number(e.target.value) })} disabled={!cfg.enabled} className="min-h-9">
                          {limitOptions(src).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-ink-4">{st.setByPlatform}</span>
                      )}
                    </td>
                    <td className="py-2 text-right">{t.common.credits(String(cost))}</td>
                    <td className="py-2 text-right text-ink-2">{cfg.enabled ? fmt.credits(cost * estimate.searches * estimate.runsPerMonth) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong font-semibold">
                <td className="py-2.5" />
                <td className="py-2.5" colSpan={3}>
                  {st.total(estimate.searches, t.intervals[draft.intervalMinutes] ?? st.everyMinutes(draft.intervalMinutes))}
                </td>
                <td className="py-2.5 text-right">{st.perRunValue(formatInt(estimate.perRun))}</td>
                <td className="py-2.5 text-right">{fmt.credits(estimate.perMonth)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="m-0 text-[13px] text-ink-3">{st.upperBounds}</p>
      </Section>

      <Section id="schedule" title={st.schedule}>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col gap-2">
            <span id="interval-label" className="font-medium">
              {st.run}
            </span>
            <Segmented<number> label={p.runFrequency} value={draft.intervalMinutes} onChange={(v) => update({ intervalMinutes: v })} options={INTERVALS.map((i) => ({ value: i.value, label: t.intervals[i.value] ?? i.label }))} />
          </div>
          <Field label={p.monthlyBudget} hint={budget === 0 ? st.noLimit : st.aboutPerMonth(creditsToUsd(budget))}>
            <TextInput type="number" min={0} step={500} value={budget} onChange={(e) => update({ monthlyBudgetCredits: Number(e.target.value) || 0 })} className="w-44 tabular" />
          </Field>
          {monthUsed !== null && budget > 0 && !project.isDemo && (
            <div className="flex min-w-[240px] flex-[1_1_260px] flex-col gap-1.5 pt-[34px]">
              <div className="flex justify-between text-[13px] text-ink-3">
                <span>{st.usedThisMonth}</span>
                <span className="tabular">{st.usedOf(formatInt(monthUsed), formatInt(budget))}</span>
              </div>
              <Meter value={monthUsed} max={budget} label={t.shell.budgetUsed} thick />
            </div>
          )}
        </div>
        {overBudget && (
          <Notice
            tone="warn"
            action={
              <Button size="sm" variant="secondary" onClick={() => update({ monthlyBudgetCredits: suggestedBudget(estimate.perMonth) })}>
                {st.setBudgetTo(formatInt(suggestedBudget(estimate.perMonth)))}
              </Button>
            }
          >
            {st.overBudget(formatInt(estimate.perMonth), formatInt(budget))}
          </Notice>
        )}
      </Section>
      </form>

      <AlertsSection projectId={projectId} />
      <ConnectionSection />
      <DangerSection projectId={projectId} name={project.name} mentions={project.counts?.mentions ?? null} />
    </div>
  );
}

interface AlertDTO {
  id: number;
  kind: "slack" | "discord" | "webhook" | "email";
  target: string;
  enabled: boolean;
  spikeMultiplier: number;
}

/** Channel names come from the messages (`settings.alertKinds`). */
const ALERT_KINDS: { value: AlertDTO["kind"]; badge: string; placeholder: string }[] = [
  { value: "slack", badge: "SL", placeholder: "https://hooks.slack.com/services/…" },
  { value: "discord", badge: "DC", placeholder: "https://discord.com/api/webhooks/…" },
  { value: "webhook", badge: "WH", placeholder: "https://example.com/hooks/mentions" },
  { value: "email", badge: "@", placeholder: "team@example.com" },
];

function AlertsSection({ projectId }: { projectId: number }) {
  const toast = useToast();
  const { m: t } = useI18n();
  const st = t.settings;
  const { settings } = useProject();
  const alerts = useApi<{ items: AlertDTO[] }>(`/api/projects/${projectId}/alerts`);
  const [kind, setKind] = useState<AlertDTO["kind"]>("slack");
  const [target, setTarget] = useState("");
  const [multiplier, setMultiplier] = useState(3);
  const [busy, setBusy] = useState<string | null>(null);
  const meta = ALERT_KINDS.find((k) => k.value === kind)!;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast(ok, "ok");
      await alerts.reload();
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setBusy(null);
    }
  };

  const add = () =>
    run(
      "add",
      async () => {
        await api(`/api/projects/${projectId}/alerts`, { method: "POST", json: { kind, target: target.trim(), spikeMultiplier: multiplier } });
        setTarget("");
      },
      st.alertAdded(st.alertKinds[meta.value]),
    );

  return (
    <Section id="alerts" title={st.alerts} meta={st.alertsMeta}>
      {alerts.data === null ? (
        <Skeleton className="h-16 w-full" />
      ) : alerts.data.items.length === 0 ? (
        <p className="m-0 text-ink-3">{st.noAlerts}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col rounded-xl border border-track p-0">
          {alerts.data.items.map((a, i) => {
            const k = ALERT_KINDS.find((x) => x.value === a.kind);
            return (
              <li key={a.id} className={cn("animate-fade-in flex flex-wrap items-center gap-3 px-3.5 py-3", i > 0 && "border-t border-track")}>
                <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-lg bg-subtle text-[11px] font-bold">
                  {k?.badge}
                </span>
                <span className="flex min-w-0 flex-[1_1_220px] flex-col">
                  <span className="font-medium">{st.alertKinds[a.kind]}</span>
                  <span className="truncate text-[13px] text-ink-3">{st.alertRule(a.target, String(a.spikeMultiplier))}</span>
                </span>
                <Switch
                  checked={a.enabled}
                  label={st.alertToggle(st.alertKinds[a.kind])}
                  onChange={(v) => run(`toggle-${a.id}`, () => api(`/api/alerts/${a.id}`, { method: "PATCH", json: { enabled: v } }), v ? st.alertsOn : st.alertsOff)}
                />
                <Button size="sm" variant="secondary" loading={busy === `test-${a.id}`} onClick={() => run(`test-${a.id}`, () => api(`/api/alerts/${a.id}/test`, { method: "POST" }), st.testSent)}>
                  {st.sendTest}
                </Button>
                <Button size="sm" variant="ghost" loading={busy === `del-${a.id}`} onClick={() => run(`del-${a.id}`, () => api(`/api/alerts/${a.id}`, { method: "DELETE" }), st.channelRemoved)}>
                  {st.remove}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2.5">
        <Field label={st.channel}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as AlertDTO["kind"])} className="min-h-11">
            {ALERT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {st.alertKinds[k.value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={kind === "email" ? st.emailAddress : st.webhookUrl} className="min-w-[260px] flex-[1_1_320px]">
          <TextInput value={target} onChange={(e) => setTarget(e.target.value)} placeholder={meta.placeholder} type={kind === "email" ? "email" : "url"} />
        </Field>
        <Field label={st.spikeThreshold}>
          <TextInput type="number" min={1.5} max={20} step={0.5} value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value) || 3)} className="w-24 text-center" />
        </Field>
        <Button variant="ink" onClick={add} loading={busy === "add"} disabled={!target.trim()}>
          {st.addChannel}
        </Button>
      </div>
      {kind === "email" && settings && !settings.email.configured && (
        <p className="m-0 text-[13px] text-ink-3">
          {st.emailNeeds.before}
          <code className="text-xs">SMTP_URL</code>
          {st.emailNeeds.between}
          <code className="text-xs">ALERT_FROM</code>
          {st.emailNeeds.after}
        </p>
      )}
    </Section>
  );
}

function ConnectionSection() {
  const { settings, account, reloadSettings } = useProject();
  const toast = useToast();
  const { m: t, fmt } = useI18n();
  const st = t.settings;
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api<{ account: { credits: number | null } | null }>("/api/settings", { method: "PUT", json: { apiKey: key.trim() } });
      setEditing(false);
      setKey("");
      await reloadSettings();
      toast(res.account?.credits != null ? st.keySavedBalance(fmt.int(res.account.credits)) : st.keySaved, "ok");
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const fromEnv = settings?.apiKey.source === "env";

  return (
    <Section id="conn" title={st.connection}>
      {settings === null ? (
        <Skeleton className="h-10 w-80" />
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <span className="rounded-lg bg-bg px-3 py-2 font-mono text-sm">{settings.apiKey.configured ? settings.apiKey.preview : st.noKeyYet}</span>
          {settings.apiKey.configured && account?.credits != null && (
            <span className="inline-flex items-center gap-1.5 text-info-fg">
              <Check aria-hidden="true" className="size-4" strokeWidth={2.4} />
              {st.connectedCredits(fmt.int(account.credits))}
            </span>
          )}
          <span className="flex-1" />
          {!fromEnv && !editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {settings.apiKey.configured ? st.replaceKey : st.addKey}
            </Button>
          )}
        </div>
      )}
      {editing && (
        <div className="animate-fade-in flex flex-wrap items-end gap-2.5">
          <Field label={st.newKey} className="min-w-[280px] flex-[1_1_360px]">
            <TextInput mono type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={t.onboarding.keyPlaceholder} />
          </Field>
          <Button variant="ink" onClick={save} loading={saving} disabled={key.trim().length < 8}>
            {st.checkAndSave}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            {st.cancel}
          </Button>
        </div>
      )}
      <p className="m-0 text-[13px] text-ink-3">
        {fromEnv ? (
          <>
            {st.keyFromEnv.before}
            <code className="text-xs">SOCQ_API_KEY</code>
            {st.keyFromEnv.after}
          </>
        ) : (
          <>
            {st.keyStored.before}
            <code className="text-xs">SOCQ_API_KEY</code>
            {st.keyStored.after}
          </>
        )}
      </p>
    </Section>
  );
}

function DangerSection({ projectId, name, mentions }: { projectId: number; name: string; mentions: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const { reloadProjects } = useProject();
  const { m: t, fmt } = useI18n();
  const st = t.settings;
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}`, { method: "DELETE" });
      await reloadProjects();
      toast(st.deleted(name), "ok");
      router.replace("/");
    } catch (error) {
      toast(errorText(error), "error");
      setBusy(false);
    }
  };

  return (
    <Card aria-labelledby="danger" className="flex flex-col gap-4 border-[#f1c9b6] px-[22px] py-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-[1_1_320px] flex-col gap-1">
          <h2 id="danger" className="m-0 text-base font-semibold">
            {st.deleteTitle}
          </h2>
          <p className="m-0 text-ink-3">{st.deleteBody(mentions !== null ? fmt.int(mentions) : null)}</p>
        </div>
        {!confirming && (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {st.deleteProject}
          </Button>
        )}
      </div>
      {confirming && (
        <div className="animate-fade-in flex flex-wrap items-end gap-2.5">
          <Field label={st.typeToConfirm(name)} className="min-w-[240px] flex-[1_1_300px]">
            <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
          <Button variant="danger" onClick={remove} loading={busy} disabled={typed.trim() !== name}>
            {st.deleteForGood}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            {st.cancel}
          </Button>
        </div>
      )}
    </Card>
  );
}
