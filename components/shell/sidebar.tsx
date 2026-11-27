"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Globe, Inbox, Plus, SlidersHorizontal } from "lucide-react";
import { LOCALES, useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";
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

/** Interface language picker; the choice is remembered in this browser. */
export function LanguageSelect({ className }: { className?: string }) {
  const { locale, setLocale, m } = useI18n();
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">{m.common.language}</span>
      <Globe aria-hidden="true" className="pointer-events-none absolute left-2 size-3.5 text-ink-3" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="min-h-8 cursor-pointer appearance-none rounded-lg border border-line bg-surface pr-2 pl-7 text-xs font-medium text-ink-2 hover:text-ink focus:border-ink focus:outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Sidebar({ projectId, projects, unread, balance, monthUsed, monthBudget, connected }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { m, fmt } = useI18n();
  const formatInt = fmt.int;
  const base = `/p/${projectId}`;
  const nav = [
    { href: `${base}/inbox`, label: m.shell.inbox, icon: Inbox, badge: unread },
    { href: `${base}/dashboard`, label: m.shell.dashboard, icon: BarChart3, badge: null },
    { href: `${base}/settings`, label: m.shell.settings, icon: SlidersHorizontal, badge: null },
  ];

  return (
    <nav
      aria-label={m.shell.primaryNav}
      // Desktop: as tall as the window and pinned while the page scrolls, so the balance, language and links at
      // the bottom are always in view; a long project list scrolls inside the sidebar.
      className="flex flex-[1_1_240px] flex-col gap-3 border-b border-line bg-bg px-4 py-3 md:sticky md:top-0 md:h-dvh md:self-start md:gap-6 md:overflow-y-auto md:border-r md:border-b-0 md:py-5"
    >
      {/* Phones: language next to the logo. Desktop: at the bottom, so the logo keeps one line in the narrow sidebar. */}
      <div className="flex items-center justify-between gap-2">
        <Logo />
        <LanguageSelect className="md:hidden" />
      </div>

      <label className="relative">
        <span className="sr-only">{m.shell.project}</span>
        <select
          value={projectId}
          onChange={(e) => router.push(`/p/${e.target.value}/inbox`)}
          className="min-h-11 w-full cursor-pointer appearance-none truncate rounded-[10px] border border-line bg-surface pr-9 pl-3 font-semibold text-ink focus:border-ink focus:outline-none"
        >
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </label>

      <div className="flex flex-row gap-1 md:flex-col md:gap-0.5">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-2 no-underline transition-colors duration-150 md:flex-none md:justify-start md:gap-2.5 md:px-3",
                active ? "bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--color-line)]" : "font-medium text-ink-2 hover:bg-subtle hover:text-ink",
              )}
            >
              {/* Text only on phones: three translated labels plus icons do not fit 390px (German). */}
              <Icon aria-hidden="true" className={cn("size-[18px] max-sm:hidden", active && "text-accent")} strokeWidth={2} />
              <span className="md:flex-1">{item.label}</span>
              {item.badge ? <span className="tabular rounded-full bg-ink px-2 text-xs font-semibold text-white">{formatInt(item.badge)}</span> : null}
            </Link>
          );
        })}
      </div>

      <div className="hidden flex-col gap-1.5 md:flex">
        <span className="px-3 text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase">{m.shell.projects}</span>
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
              {p.paused && <span className="text-xs text-ink-4">{m.shell.paused}</span>}
            </Link>
          ))
        )}
        <Link href="/onboarding?new=1" className="flex min-h-9 items-center gap-2.5 rounded-lg px-3 font-medium text-ink-3 no-underline hover:bg-subtle hover:text-ink">
          <Plus aria-hidden="true" className="size-4" />
          {m.shell.newProject}
        </Link>
      </div>

      <div className="hidden flex-1 md:block" />

      {connected === false ? (
        <div className="hidden flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 md:flex">
          <span className="text-[13px] text-ink-2">{m.shell.connectPrompt}</span>
          <Link href="/onboarding" className="inline-flex min-h-10 items-center justify-center rounded-[10px] bg-accent-strong px-3 font-semibold text-white no-underline transition-colors hover:bg-accent-hover">
            {m.shell.connectSocq}
          </Link>
        </div>
      ) : (
      <div className="hidden flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5 md:flex">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-ink-3">{m.shell.balance}</span>
          {balance === null ? <Skeleton className="h-5 w-16" /> : <span className="font-display tabular text-base font-semibold">{fmt.credits(balance)}</span>}
        </div>
        {monthBudget !== null && monthUsed !== null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-ink-3">
              <span>{m.shell.thisMonth}</span>
              <span className="tabular">
                {formatInt(monthUsed)} / {formatInt(monthBudget)}
              </span>
            </div>
            <Meter value={monthUsed} max={monthBudget} label={m.shell.budgetUsed} />
          </div>
        )}
        <a href="https://socq.ai/pricing?utm_source=open-social-listening&utm_medium=app&utm_campaign=topup" target="_blank" rel="noopener" className="text-[13px] font-medium">
          {m.shell.topUp}
        </a>
      </div>
      )}
      <LanguageSelect className="hidden self-start md:inline-flex" />
      <div className="hidden justify-between px-1.5 text-xs md:flex">
        <a href={SOCQ_URL} target="_blank" rel="noopener" className="text-ink-3 hover:text-ink">
          {m.shell.poweredBy}
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-ink-3 hover:text-ink">
          v0.1 · GitHub
        </a>
      </div>
    </nav>
  );
}
