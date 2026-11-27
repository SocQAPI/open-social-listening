"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, BarChart3, Globe, Inbox, Plus, SlidersHorizontal } from "lucide-react";
import { LOCALES, useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";
import { CountUp, Dropdown, Meter, Skeleton } from "@/components/ui/primitives";
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
export function LanguageSelect({
  className,
  placement = "auto",
  align = "end",
}: {
  className?: string;
  placement?: "auto" | "up" | "down";
  align?: "start" | "end";
}) {
  const { locale, setLocale, m } = useI18n();
  return (
    <Dropdown<Locale>
      label={m.common.language}
      value={locale}
      onChange={setLocale}
      options={LOCALES.map((l) => ({ value: l.code, label: l.label, lang: l.code }))}
      placement={placement}
      align={align}
      size="sm"
      className={className}
      buttonClassName="w-auto border-line text-ink-2 hover:text-ink"
      menuClassName="min-w-48"
      icon={<Globe aria-hidden="true" className="size-3.5 text-ink-3 transition-transform duration-500 ease-out group-hover:rotate-[24deg]" />}
    />
  );
}

/**
 * Primary navigation. The white "you are here" pill is a single element that slides to the active link, in a
 * row on phones and a column on desktop.
 */
function NavLinks({ items, pathname }: { items: { href: string; label: string; icon: typeof Inbox; badge: number | null }[]; pathname: string }) {
  const { fmt } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const index = items.findIndex((item) => item.href === pathname);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const place = () => {
      const link = list.querySelectorAll<HTMLAnchorElement>("a")[index];
      setPill(link ? { x: link.offsetLeft, y: link.offsetTop, w: link.offsetWidth, h: link.offsetHeight } : null);
    };
    place();
    // The links change size with the language and when the unread badge appears.
    const observer = new ResizeObserver(place);
    observer.observe(list);
    list.querySelectorAll("a").forEach((a) => observer.observe(a));
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(id);
    };
  }, [index]);

  return (
    <div ref={listRef} className="relative flex flex-row gap-1 md:flex-col md:gap-0.5">
      {pill && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-0 left-0 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgba(23,24,28,0.06)]",
            animate && "transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.3,1.1,0.5,1)]",
          )}
          style={{ width: pill.w, height: pill.h, transform: `translate(${pill.x}px, ${pill.y}px)` }}
        />
      )}
      {items.map((item) => {
        const active = item.href === pathname;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-2 no-underline transition-[background-color,color] duration-150 md:flex-none md:justify-start md:gap-2.5 md:px-3",
              active ? "font-semibold text-ink" : "font-medium text-ink-2 hover:bg-subtle hover:text-ink",
              // Until the pill is measured, the active link carries its own background.
              active && !pill && "bg-surface shadow-[0_0_0_1px_var(--color-line)]",
            )}
          >
            {/* Text only on phones: three translated labels plus icons do not fit 390px (German). */}
            <Icon
              aria-hidden="true"
              strokeWidth={2}
              className={cn(
                "size-[18px] transition-[color,transform] duration-200 ease-out group-hover:scale-110 max-sm:hidden",
                active ? "text-accent" : "text-ink-3 group-hover:text-ink",
              )}
            />
            <span className="md:flex-1">{item.label}</span>
            {item.badge ? (
              // Keyed by the count, so the badge pops whenever it changes.
              <span key={item.badge} className="animate-pop-in tabular rounded-full bg-ink px-2 text-xs leading-5 font-semibold text-white">
                {fmt.int(item.badge)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
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
  const projectDot = (p: SidebarProject) => (p.paused ? "bg-neu" : "bg-brand");

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
        <LanguageSelect className="md:hidden" placement="down" align="end" />
      </div>

      {projects === null ? (
        <Skeleton className="h-11 w-full rounded-[10px]" />
      ) : (
        <Dropdown<number>
          label={m.shell.project}
          value={projectId}
          onChange={(id) => router.push(`/p/${id}/inbox`)}
          options={projects.map((p) => ({ value: p.id, label: p.name, dot: projectDot(p), note: p.paused ? m.shell.paused : undefined }))}
          placement="down"
          size="lg"
          className="w-full"
          buttonClassName="border-line text-sm shadow-[0_1px_2px_rgba(23,24,28,0.04)]"
        />
      )}

      <NavLinks items={nav} pathname={pathname} />

      <div className="hidden flex-col gap-1.5 md:flex">
        <span className="px-3 text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase">{m.shell.projects}</span>
        {projects === null ? (
          <div className="flex flex-col gap-2 px-3 py-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ) : (
          projects.map((p) => {
            const current = p.id === projectId;
            return (
              <Link
                key={p.id}
                href={`/p/${p.id}/inbox`}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "group flex min-h-9 items-center gap-2.5 rounded-lg px-3 no-underline transition-colors duration-150 hover:bg-subtle",
                  current ? "font-semibold text-ink" : "font-medium text-ink-2 hover:text-ink",
                )}
              >
                {/* The open project's dot breathes, like a live signal. */}
                <span aria-hidden="true" className="relative flex size-2">
                  {current && !p.paused && <span className="animate-ping-soft absolute inset-0 rounded-full bg-brand" />}
                  <span className={cn("relative size-2 rounded-full transition-transform duration-200 group-hover:scale-125", projectDot(p))} />
                </span>
                <span className="flex-1 truncate">{p.name}</span>
                {p.paused && <span className="text-xs font-normal text-ink-4">{m.shell.paused}</span>}
              </Link>
            );
          })
        )}
        <Link
          href="/onboarding?new=1"
          className="group flex min-h-9 items-center gap-2.5 rounded-lg px-3 font-medium text-ink-3 no-underline transition-colors duration-150 hover:bg-subtle hover:text-ink"
        >
          <Plus aria-hidden="true" className="size-4 transition-transform duration-300 ease-out group-hover:rotate-90" />
          {m.shell.newProject}
        </Link>
      </div>

      <div className="hidden flex-1 md:block" />

      {connected === false ? (
        <div className="hidden flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 md:flex">
          <span className="text-[13px] text-ink-2">{m.shell.connectPrompt}</span>
          <Link
            href="/onboarding"
            className="inline-flex min-h-10 items-center justify-center rounded-[10px] bg-accent-strong px-3 font-semibold text-white no-underline transition-[background-color,box-shadow] hover:bg-accent-hover hover:shadow-[0_4px_12px_rgba(212,57,31,0.28)]"
          >
            {m.shell.connectSocq}
          </Link>
        </div>
      ) : (
        <div className="hidden flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5 shadow-[0_1px_2px_rgba(23,24,28,0.04)] md:flex">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-ink-3">{m.shell.balance}</span>
            {balance === null ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <span className="font-display tabular text-base font-semibold">
                <CountUp value={balance} format={(n) => fmt.credits(n)} />
              </span>
            )}
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
          <a
            href="https://socq.ai/pricing?utm_source=open-social-listening&utm_medium=app&utm_campaign=topup"
            target="_blank"
            rel="noopener"
            className="group inline-flex items-center gap-1 self-start text-[13px] font-medium no-underline hover:underline"
          >
            {m.shell.topUp}
            <ArrowUpRight aria-hidden="true" className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      )}
      <LanguageSelect className="hidden self-start md:inline-flex" placement="up" align="start" />
      <div className="hidden justify-between px-1.5 text-xs md:flex">
        <a href={SOCQ_URL} target="_blank" rel="noopener" className="text-ink-3 no-underline transition-colors hover:text-ink">
          {m.shell.poweredBy}
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-ink-3 no-underline transition-colors hover:text-ink">
          v0.1 · GitHub
        </a>
      </div>
    </nav>
  );
}
