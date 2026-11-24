"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Inbox, Plus, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { formatInt } from "@/lib/ui/format";
import { Meter, Skeleton } from "@/components/ui/primitives";
import { Logo } from "./logo";

export interface SidebarProject {
  id: number;
  name: string;
  isDemo: boolean;
  paused: boolean;
}

export interface SidebarProps {
  projectId: number;
  projects: SidebarProject[] | null;
  unread: number | null;
  balance: number | null;
  monthUsed: number | null;
  monthBudget: number | null;
  /** null while settings load. */
  connected: boolean | null;
}

const REPO_URL = "https://github.com/SocQAPI/open-social-listening";
const SOCQ_URL = "https://socq.ai/?utm_source=open-social-listening&utm_medium=app&utm_campaign=sidebar";

export function Sidebar({ projectId, projects, unread, balance, monthUsed, monthBudget, connected }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/p/${projectId}`;
  const current = projects?.find((p) => p.id === projectId);
  const nav = [
    { href: `${base}/inbox`, label: "Inbox", icon: Inbox, badge: unread },
    { href: `${base}/dashboard`, label: "Dashboard", icon: BarChart3, badge: null },
    { href: `${base}/settings`, label: "Settings", icon: SlidersHorizontal, badge: null },
  ];

  return (
    <nav aria-label="Primary" className="flex flex-[1_1_240px] flex-col gap-6 border-r border-line bg-bg px-4 py-5">
      <Logo />

      <label className="relative">
        <span className="sr-only">Project</span>
        <select
          value={projectId}
          onChange={(e) => router.push(`/p/${e.target.value}/inbox`)}
          className="min-h-11 w-full cursor-pointer appearance-none rounded-[10px] border border-line bg-surface pr-16 pl-3 font-semibold text-ink focus:border-ink focus:outline-none"
        >
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {current?.isDemo && (
          <span className="pointer-events-none absolute top-1/2 right-8 -translate-y-1/2 rounded-md bg-subtle px-2 py-0.5 text-xs font-medium text-ink-3">Demo</span>
        )}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </label>

      <div className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-lg px-3 no-underline transition-colors duration-150",
                active ? "bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--color-line)]" : "font-medium text-ink-2 hover:bg-subtle hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" className={cn("size-[18px]", active && "text-accent")} strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? <span className="tabular rounded-full bg-ink px-2 text-xs font-semibold text-white">{formatInt(item.badge)}</span> : null}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="px-3 text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase">Projects</span>
        {projects === null ? (
          <div className="flex flex-col gap-2 px-3 py-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ) : (
          projects.map((p) => (
            <Link
              key={p.id}
              href={`/p/${p.id}/inbox`}
              className={cn("flex min-h-9 items-center gap-2.5 rounded-lg px-3 font-medium no-underline hover:bg-subtle", p.id === projectId ? "text-ink" : "text-ink-2")}
            >
              <span aria-hidden="true" className={cn("size-2 rounded-full", p.paused ? "bg-neu" : "bg-brand")} />
              <span className="flex-1 truncate">{p.name}</span>
              {p.paused && <span className="text-xs text-ink-4">Paused</span>}
            </Link>
          ))
        )}
        <Link href="/onboarding?new=1" className="flex min-h-9 items-center gap-2.5 rounded-lg px-3 font-medium text-ink-3 no-underline hover:bg-subtle hover:text-ink">
          <Plus aria-hidden="true" className="size-4" />
          New project
        </Link>
      </div>

      <div className="flex-1" />

      {connected === false ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5">
          <span className="text-[13px] text-ink-2">Connect a SocQ API key to track your own brand.</span>
          <Link href="/onboarding" className="inline-flex min-h-10 items-center justify-center rounded-[10px] bg-accent-strong px-3 font-semibold text-white no-underline transition-colors hover:bg-accent-hover">
            Connect SocQ
          </Link>
        </div>
      ) : (
      <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-ink-3">SocQ balance</span>
          {balance === null ? <Skeleton className="h-5 w-16" /> : <span className="font-display tabular text-base font-semibold">{formatInt(balance)} cr</span>}
        </div>
        {monthBudget !== null && monthUsed !== null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-ink-3">
              <span>This month</span>
              <span className="tabular">
                {formatInt(monthUsed)} / {formatInt(monthBudget)}
              </span>
            </div>
            <Meter value={monthUsed} max={monthBudget} label="Monthly budget used" />
          </div>
        )}
        <a href="https://socq.ai/pricing?utm_source=open-social-listening&utm_medium=app&utm_campaign=topup" target="_blank" rel="noopener" className="text-[13px] font-medium">
          Top up on socq.ai
        </a>
      </div>
      )}
      <div className="flex justify-between px-1.5 text-xs">
        <a href={SOCQ_URL} target="_blank" rel="noopener" className="text-ink-3 hover:text-ink">
          Powered by SocQ
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-ink-3 hover:text-ink">
          v0.1 · GitHub
        </a>
      </div>
    </nav>
  );
}
