"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { REPO_URL, STATIC_DEMO } from "@/lib/demo/static";
import { useI18n, type Messages } from "@/lib/i18n";
import { pausedText, useProject } from "./project-context";

function relative(iso: string | null | undefined, future: boolean, t: Messages["time"]): string | null {
  if (!iso) return null;
  const diff = Math.round((Date.parse(iso) - Date.now()) / 60_000) * (future ? 1 : -1);
  if (!Number.isFinite(diff)) return null;
  if (diff < 1) return future ? t.anyMinute : t.justNow;
  if (diff < 60) return future ? t.inMinutes(diff) : t.agoMinutes(diff);
  const h = Math.floor(diff / 60);
  const min = diff % 60;
  if (h < 48) return future ? t.inHours(h, min) : t.agoHours(h, min);
  return future ? t.inDays(Math.round(h / 24)) : t.agoDays(Math.round(h / 24));
}

export function ProjectStatusLine() {
  const { project, running } = useProject();
  const { m } = useI18n();
  if (!project) return <span>&nbsp;</span>;
  const parts: string[] = [project.name];
  if (project.isDemo) parts.push(m.shell.demoData);
  else if (running) parts.push(m.shell.runningNow);
  else if (project.paused) parts.push(m.shell.pausedStatus);
  else {
    const last = relative(project.lastRunAt, false, m.time);
    const next = relative(project.nextRunAt, true, m.time);
    if (last) parts.push(m.shell.lastRun(last));
    if (next) parts.push(m.shell.nextRun(next));
  }
  return <>{parts.join(" · ")}</>;
}

export function RunButton() {
  const { project, running, runNow } = useProject();
  const { m, fmt } = useI18n();
  if (!project || project.isDemo) return null;
  return (
    <Button variant="primary" onClick={runNow} loading={running} icon={<RefreshCw aria-hidden="true" className="size-4" />}>
      {running ? m.shell.running : m.shell.runNow(fmt.int(project.estimate.perRunCredits))}
    </Button>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display m-0 text-[28px] font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="m-0 text-ink-3">
          <ProjectStatusLine />
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Demo and paused projects explain themselves right under the header. */
export function ProjectBanner() {
  const { project, settings } = useProject();
  const { m } = useI18n();
  if (!project) return null;
  if (project.isDemo && STATIC_DEMO) {
    return (
      <Notice
        tone="info"
        action={
          <a href={REPO_URL} className="inline-flex min-h-10 items-center rounded-[10px] bg-ink px-4 font-semibold text-white no-underline hover:bg-ink-2">
            {m.shell.getOnGithub}
          </a>
        }
      >
        {m.shell.staticDemoBanner}
      </Notice>
    );
  }
  if (project.isDemo) {
    const connected = settings?.apiKey.configured;
    return (
      <Notice
        tone="info"
        action={
          <Link href="/onboarding?new=1" className="inline-flex min-h-10 items-center rounded-[10px] bg-ink px-4 font-semibold text-white no-underline hover:bg-ink-2">
            {connected ? m.shell.createProject : m.shell.connectSocq}
          </Link>
        }
      >
        {m.shell.demoBanner}
        {m.common.sentenceGap}
        {connected ? m.shell.demoBannerCreate : m.shell.demoBannerConnect}
      </Notice>
    );
  }
  if (project.paused) {
    return (
      <Notice
        tone="warn"
        action={
          <Link href={`/p/${project.id}/settings`} className="font-semibold">
            {m.shell.openSettings}
          </Link>
        }
      >
        {pausedText(project.pausedReason ?? "manual")}
      </Notice>
    );
  }
  return null;
}
