"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { REPO_URL, STATIC_DEMO } from "@/lib/demo/static";
import { formatInt } from "@/lib/ui/format";
import { pausedText, useProject } from "./project-context";

function relative(iso: string | null | undefined, future: boolean): string | null {
  if (!iso) return null;
  const diff = Math.round((Date.parse(iso) - Date.now()) / 60_000) * (future ? 1 : -1);
  if (!Number.isFinite(diff)) return null;
  if (diff < 1) return future ? "any minute" : "just now";
  if (diff < 60) return `${future ? "in " : ""}${diff} min${future ? "" : " ago"}`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h < 48) return `${future ? "in " : ""}${h} h${m ? ` ${m} min` : ""}${future ? "" : " ago"}`;
  return `${future ? "in " : ""}${Math.round(h / 24)} days${future ? "" : " ago"}`;
}

export function ProjectStatusLine() {
  const { project, running } = useProject();
  if (!project) return <span>&nbsp;</span>;
  const parts: string[] = [project.name];
  if (project.isDemo) parts.push("demo data");
  else if (running) parts.push("running now…");
  else if (project.paused) parts.push("paused");
  else {
    const last = relative(project.lastRunAt, false);
    const next = relative(project.nextRunAt, true);
    if (last) parts.push(`last run ${last}`);
    if (next) parts.push(`next run ${next}`);
  }
  return <>{parts.join(" · ")}</>;
}

export function RunButton() {
  const { project, running, runNow } = useProject();
  if (!project || project.isDemo) return null;
  return (
    <Button variant="primary" onClick={runNow} loading={running} icon={<RefreshCw aria-hidden="true" className="size-4" />}>
      {running ? "Running…" : `Run now · ~${formatInt(project.estimate.perRunCredits)} cr`}
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
  if (!project) return null;
  if (project.isDemo && STATIC_DEMO) {
    return (
      <Notice
        tone="info"
        action={
          <a href={REPO_URL} className="inline-flex min-h-10 items-center rounded-[10px] bg-ink px-4 font-semibold text-white no-underline hover:bg-ink-2">
            Get it on GitHub
          </a>
        }
      >
        This is a live demo with sample data for a made-up brand. Run Open Social Listening on your own server to track yours.
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
            {connected ? "Create your project" : "Connect SocQ"}
          </Link>
        }
      >
        You are looking at sample data for a made-up brand. {connected ? "Create a project to track your own brand." : "Connect a SocQ API key to track your own brand."}
      </Notice>
    );
  }
  if (project.paused) {
    return (
      <Notice
        tone="warn"
        action={
          <Link href={`/p/${project.id}/settings`} className="font-semibold">
            Open settings
          </Link>
        }
      >
        {pausedText(project.pausedReason ?? "manual")}
      </Notice>
    );
  }
  return null;
}
