"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Github, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { REPO_URL, STATIC_DEMO, guideUrl } from "@/lib/demo/static";
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
const bannerPrimary =
  "group inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-ink px-4 font-semibold text-white no-underline shadow-[0_1px_2px_rgba(23,24,28,0.2)] transition-[background-color,box-shadow,transform] hover:bg-ink-2 hover:shadow-[0_4px_12px_rgba(23,24,28,0.18)] active:scale-[0.98]";
const bannerSecondary =
  "group inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-info-fg/20 bg-white/70 px-4 font-semibold text-info-fg no-underline transition-[background-color,border-color,transform] hover:border-info-fg/40 hover:bg-white active:scale-[0.98]";

export function ProjectBanner() {
  const { project, settings } = useProject();
  const { m, locale } = useI18n();
  if (!project) return null;
  if (project.isDemo && STATIC_DEMO) {
    // Visitors of the public demo mostly want to run it themselves: the deployment guide comes first.
    return (
      <Notice
        tone="info"
        action={
          <span className="flex flex-wrap gap-2">
            <a href={guideUrl("deploy", locale)} target="_blank" rel="noopener" className={bannerPrimary}>
              <BookOpen aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:-rotate-6" />
              {m.shell.deployGuide}
            </a>
            <a href={REPO_URL} target="_blank" rel="noopener" className={bannerSecondary}>
              <Github aria-hidden="true" className="size-4" />
              GitHub
            </a>
          </span>
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
          <span className="flex flex-wrap gap-2">
            <Link href="/onboarding?new=1" className={bannerPrimary}>
              {connected ? m.shell.createProject : m.shell.connectSocq}
            </Link>
            <a href={guideUrl("getting-started", locale)} target="_blank" rel="noopener" className={bannerSecondary}>
              <BookOpen aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:-rotate-6" />
              {m.shell.gettingStarted}
            </a>
          </span>
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
