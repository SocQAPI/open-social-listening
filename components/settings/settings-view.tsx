"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Pause, Play } from "lucide-react";
import { api, errorText, useApi } from "@/lib/ui/api";
import { cn } from "@/lib/ui/cn";
import { creditsToUsd, formatInt } from "@/lib/ui/format";
import { INTERVALS, SOURCES, draftEstimate, limitOptions, searchCost, suggestedBudget, toCompetitors, type ProjectDraft } from "@/lib/ui/draft";
import { Button } from "@/components/ui/button";
import { Card, Field, Meter, Notice, Select, Skeleton, Switch, TextInput } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { TermEditor } from "@/components/ui/term-editor";
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
      toast("Keep at least one brand term, competitor or topic.", "error");
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
      toast("Settings saved. They apply from the next run.", "ok");
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
      toast(project.paused ? "Listening resumed." : "Listening paused.", "ok");
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
          <h1 className="font-display m-0 text-[28px] font-semibold tracking-[-0.02em]">Project settings</h1>
          <p className="m-0 text-ink-3">
            <ProjectStatusLine /> · changes apply from the next run
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!project.isDemo && (
            <Button variant="secondary" onClick={togglePause} icon={project.paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}>
              {project.paused ? "Resume" : "Pause"}
            </Button>
          )}
          <Button type="submit" form="project-settings" variant={dirty || saving ? "primary" : "secondary"} loading={saving} disabled={!dirty} icon={<Check aria-hidden="true" className="size-4" />}>
            {dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </header>
      <ProjectBanner />

      <form id="project-settings" onSubmit={save} className="flex flex-col gap-5">
      <Section id="tracking" title="What we listen for" meta={`${estimate.searches} search${estimate.searches === 1 ? "" : "es"} per source per run`}>
        <Field label="Project name" className="max-w-md">
          <TextInput value={draft.name} onChange={(e) => update({ name: e.target.value })} maxLength={80} />
        </Field>
        <TermEditor kind="brand" title="Your brand" hint="Names and handles people use for you." values={draft.brandTerms} onChange={(v) => update({ brandTerms: v })} placeholder="e.g. @yourbrand" />
        <TermEditor
          kind="competitor"
          title="Competitors"
          hint="Tracked separately for share of voice. Up to 10."
          values={draft.competitorNames}
          onChange={(v) => update({ competitorNames: v })}
          placeholder="Competitor name"
          max={10}
        />
        <TermEditor kind="keyword" title="Topics" hint="Category words where buyers ask for recommendations." values={draft.keywords} onChange={(v) => update({ keywords: v })} placeholder="e.g. best crm for startups" />
        <TermEditor
          kind="exclude"
          title="Ignore posts containing"
          hint="Filters out look-alike names. Not searched, so free."
          values={draft.excludeTerms}
          onChange={(v) => update({ excludeTerms: v })}
          placeholder="Word to ignore"
        />
      </Section>

      <Section id="sources" title="Sources" meta="SocQ list prices · 1 credit = $0.005">
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="w-16 py-2 font-medium">On</th>
                <th scope="col" className="py-2 font-medium">Source</th>
                <th scope="col" className="py-2 font-medium">SocQ endpoint</th>
                <th scope="col" className="py-2 font-medium">Results per search</th>
                <th scope="col" className="py-2 text-right font-medium">Per search</th>
                <th scope="col" className="py-2 text-right font-medium">Per month</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((src) => {
                const cfg = draft.sources[src.id] ?? { enabled: false, resultsLimit: src.limits.default };
                const cost = searchCost(src, cfg.resultsLimit);
                return (
                  <tr key={src.id} className="border-t border-track">
                    <td className="py-2">
                      <Switch checked={cfg.enabled} onChange={(v) => setSource(src.id, { enabled: v })} label={`${src.label} on or off`} />
                    </td>
                    <td className={cn("py-2 font-medium", !cfg.enabled && "text-ink-4")}>{src.label}</td>
                    <td className="py-2 font-mono text-xs text-ink-3">{src.endpoint}</td>
                    <td className="py-2">
                      {src.supportsResultsLimit ? (
                        <Select aria-label={`Results per search on ${src.label}`} value={cfg.resultsLimit} onChange={(e) => setSource(src.id, { resultsLimit: Number(e.target.value) })} disabled={!cfg.enabled} className="min-h-9">
                          {limitOptions(src).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-ink-4">Set by the platform</span>
                      )}
                    </td>
                    <td className="py-2 text-right">{cost} cr</td>
                    <td className="py-2 text-right text-ink-2">{cfg.enabled ? `${formatInt(cost * estimate.searches * estimate.runsPerMonth)} cr` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong font-semibold">
                <td className="py-2.5" />
                <td className="py-2.5" colSpan={3}>
                  Total for {estimate.searches} search{estimate.searches === 1 ? "" : "es"}, {INTERVALS.find((i) => i.value === draft.intervalMinutes)?.label.toLowerCase() ?? `every ${draft.intervalMinutes} min`}
                </td>
                <td className="py-2.5 text-right">{formatInt(estimate.perRun)} / run</td>
                <td className="py-2.5 text-right">{formatInt(estimate.perMonth)} cr</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="m-0 text-[13px] text-ink-3">Estimates are upper bounds: SocQ bills only the results a search actually returns.</p>
      </Section>

      <Section id="schedule" title="Schedule and budget">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col gap-2">
            <span id="interval-label" className="font-medium">
              Run
            </span>
            <Segmented<number> label="Run frequency" value={draft.intervalMinutes} onChange={(v) => update({ intervalMinutes: v })} options={INTERVALS.map((i) => ({ value: i.value, label: i.label }))} />
          </div>
          <Field label="Monthly budget (credits)" hint={budget === 0 ? "0 means no limit." : `About ${creditsToUsd(budget)} a month.`}>
            <TextInput type="number" min={0} step={500} value={budget} onChange={(e) => update({ monthlyBudgetCredits: Number(e.target.value) || 0 })} className="w-44 tabular" />
          </Field>
          {monthUsed !== null && budget > 0 && !project.isDemo && (
            <div className="flex min-w-[240px] flex-[1_1_260px] flex-col gap-1.5 pt-[34px]">
              <div className="flex justify-between text-[13px] text-ink-3">
                <span>Used this month</span>
                <span className="tabular">
                  {formatInt(monthUsed)} of {formatInt(budget)}
                </span>
              </div>
              <Meter value={monthUsed} max={budget} label="Monthly budget used" thick />
            </div>
          )}
        </div>
        {overBudget && (
          <Notice
            tone="warn"
            action={
              <Button size="sm" variant="secondary" onClick={() => update({ monthlyBudgetCredits: suggestedBudget(estimate.perMonth) })}>
                Set budget to {formatInt(suggestedBudget(estimate.perMonth))}
              </Button>
            }
          >
            This setup needs about {formatInt(estimate.perMonth)} credits a month, more than the {formatInt(budget)} budget. Runs pause automatically once the budget is reached.
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

const ALERT_KINDS: { value: AlertDTO["kind"]; label: string; badge: string; placeholder: string }[] = [
  { value: "slack", label: "Slack", badge: "SL", placeholder: "https://hooks.slack.com/services/…" },
  { value: "discord", label: "Discord", badge: "DC", placeholder: "https://discord.com/api/webhooks/…" },
  { value: "webhook", label: "Webhook", badge: "WH", placeholder: "https://example.com/hooks/mentions" },
  { value: "email", label: "Email", badge: "@", placeholder: "team@example.com" },
];

function AlertsSection({ projectId }: { projectId: number }) {
  const toast = useToast();
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
      `${meta.label} alert added.`,
    );

  return (
    <Section id="alerts" title="Alerts" meta="Sent when a run finds unusually many mentions">
      {alerts.data === null ? (
        <Skeleton className="h-16 w-full" />
      ) : alerts.data.items.length === 0 ? (
        <p className="m-0 text-ink-3">No alert channels yet. Add one below to hear about spikes as they happen.</p>
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
                  <span className="font-medium">{k?.label}</span>
                  <span className="truncate text-[13px] text-ink-3">
                    {a.target} · above {a.spikeMultiplier}× the 7-day average
                  </span>
                </span>
                <Switch
                  checked={a.enabled}
                  label={`${k?.label} alerts on or off`}
                  onChange={(v) => run(`toggle-${a.id}`, () => api(`/api/alerts/${a.id}`, { method: "PATCH", json: { enabled: v } }), v ? "Alerts on." : "Alerts off.")}
                />
                <Button size="sm" variant="secondary" loading={busy === `test-${a.id}`} onClick={() => run(`test-${a.id}`, () => api(`/api/alerts/${a.id}/test`, { method: "POST" }), "Test alert sent.")}>
                  Send test
                </Button>
                <Button size="sm" variant="ghost" loading={busy === `del-${a.id}`} onClick={() => run(`del-${a.id}`, () => api(`/api/alerts/${a.id}`, { method: "DELETE" }), "Channel removed.")}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2.5">
        <Field label="Channel">
          <Select value={kind} onChange={(e) => setKind(e.target.value as AlertDTO["kind"])} className="min-h-11">
            {ALERT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={kind === "email" ? "Email address" : "Webhook URL"} className="min-w-[260px] flex-[1_1_320px]">
          <TextInput value={target} onChange={(e) => setTarget(e.target.value)} placeholder={meta.placeholder} type={kind === "email" ? "email" : "url"} />
        </Field>
        <Field label="Spike threshold">
          <TextInput type="number" min={1.5} max={20} step={0.5} value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value) || 3)} className="w-24 text-center" />
        </Field>
        <Button variant="ink" onClick={add} loading={busy === "add"} disabled={!target.trim()}>
          Add channel
        </Button>
      </div>
      {kind === "email" && settings && !settings.email.configured && (
        <p className="m-0 text-[13px] text-ink-3">
          Email needs <code className="text-xs">SMTP_URL</code> and <code className="text-xs">ALERT_FROM</code> set on the server.
        </p>
      )}
    </Section>
  );
}

function ConnectionSection() {
  const { settings, account, reloadSettings } = useProject();
  const toast = useToast();
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
      toast(res.account?.credits != null ? `Key saved · balance ${formatInt(res.account.credits)} credits` : "Key saved.", "ok");
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const fromEnv = settings?.apiKey.source === "env";

  return (
    <Section id="conn" title="SocQ connection">
      {settings === null ? (
        <Skeleton className="h-10 w-80" />
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <span className="rounded-lg bg-bg px-3 py-2 font-mono text-sm">{settings.apiKey.configured ? settings.apiKey.preview : "No key yet"}</span>
          {settings.apiKey.configured && account?.credits != null && (
            <span className="inline-flex items-center gap-1.5 text-info-fg">
              <Check aria-hidden="true" className="size-4" strokeWidth={2.4} />
              Connected · {formatInt(account.credits)} credits
            </span>
          )}
          <span className="flex-1" />
          {!fromEnv && !editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {settings.apiKey.configured ? "Replace key" : "Add key"}
            </Button>
          )}
        </div>
      )}
      {editing && (
        <div className="animate-fade-in flex flex-wrap items-end gap-2.5">
          <Field label="New SocQ API key" className="min-w-[280px] flex-[1_1_360px]">
            <TextInput mono type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste the key from your SocQ dashboard" />
          </Field>
          <Button variant="ink" onClick={save} loading={saving} disabled={key.trim().length < 8}>
            Check and save
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      )}
      <p className="m-0 text-[13px] text-ink-3">
        {fromEnv ? (
          <>
            This key comes from <code className="text-xs">SOCQ_API_KEY</code> on the server. Change it there.
          </>
        ) : (
          <>
            The key is stored in this server&apos;s database. Setting <code className="text-xs">SOCQ_API_KEY</code> on the server overrides it.
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
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}`, { method: "DELETE" });
      await reloadProjects();
      toast(`Deleted ${name}.`, "ok");
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
            Delete this project
          </h2>
          <p className="m-0 text-ink-3">
            Removes the project{mentions !== null ? `, its ${formatInt(mentions)} saved mentions` : ""} and its run history from this server. Export first if you need them.
          </p>
        </div>
        {!confirming && (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Delete project
          </Button>
        )}
      </div>
      {confirming && (
        <div className="animate-fade-in flex flex-wrap items-end gap-2.5">
          <Field label={`Type "${name}" to confirm`} className="min-w-[240px] flex-[1_1_300px]">
            <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
          <Button variant="danger" onClick={remove} loading={busy} disabled={typed.trim() !== name}>
            Delete for good
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      )}
    </Card>
  );
}
