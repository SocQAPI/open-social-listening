"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { BarChart3, Check, ChevronDown, Globe, Inbox, Plus, SlidersHorizontal } from "lucide-react";
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

/**
 * Interface language picker: a button and a listbox menu (the native select can't be styled). The menu opens
 * upward at the bottom of the sidebar and downward elsewhere. Keyboard: arrows, Home/End, Enter/Space, Escape.
 */
export function LanguageSelect({
  className,
  placement = "down",
  align = "end",
}: {
  className?: string;
  placement?: "up" | "down";
  align?: "start" | "end";
}) {
  const { locale, setLocale, m } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const openMenu = () => {
    setActive(Math.max(0, LOCALES.findIndex((l) => l.code === locale)));
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (code: Locale) => {
    setLocale(code);
    close(true);
  };

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu();
    }
  };
  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = LOCALES.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => (i >= last ? 0 : i + 1)),
      ArrowUp: () => setActive((i) => (i <= 0 ? last : i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(LOCALES[active].code),
      " ": () => choose(LOCALES[active].code),
      Escape: () => close(true),
    };
    if (e.key === "Tab") return close(false);
    const action = keys[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  };

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${m.common.language}: ${current.label}`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
        className={cn(
          "group inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-surface px-2.5 text-xs font-medium",
          "transition-[border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97]",
          "focus-visible:ring-2 focus-visible:ring-ink/15 focus-visible:outline-none",
          open ? "border-ink text-ink shadow-[0_0_0_3px_rgba(23,24,28,0.06)]" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
        )}
      >
        <Globe aria-hidden="true" className="size-3.5 text-ink-3 transition-transform duration-500 ease-out group-hover:rotate-[24deg]" />
        <span lang={current.code}>{current.label}</span>
        <ChevronDown aria-hidden="true" className={cn("size-3.5 text-ink-4 transition-transform duration-200 ease-out", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={m.common.language}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKeyDown}
          className={cn(
            "absolute z-50 m-0 min-w-48 list-none rounded-xl border border-line bg-surface p-1 focus:outline-none",
            "shadow-[0_16px_40px_rgba(23,24,28,0.14),0_2px_6px_rgba(23,24,28,0.06)]",
            placement === "up" ? "bottom-full mb-2 animate-pop-up" : "top-full mt-2 animate-pop-down",
            placement === "up" ? (align === "end" ? "origin-bottom-right" : "origin-bottom-left") : align === "end" ? "origin-top-right" : "origin-top-left",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {LOCALES.map((l, i) => {
            const selected = l.code === locale;
            return (
              <li
                key={l.code}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                lang={l.code}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(l.code)}
                style={{ animationDelay: `${40 + i * 25}ms` }}
                className={cn(
                  "animate-fade-in flex min-h-9 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-100",
                  i === active ? "bg-subtle text-ink" : "text-ink-2",
                  selected && "font-semibold text-ink",
                )}
              >
                <span className="flex-1">{l.label}</span>
                <Check
                  aria-hidden="true"
                  strokeWidth={2.4}
                  className={cn("size-4 text-accent transition-[opacity,transform] duration-200 ease-out", selected ? "scale-100 opacity-100" : "scale-50 opacity-0")}
                />
              </li>
            );
          })}
        </ul>
      )}
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
      <LanguageSelect className="hidden self-start md:inline-flex" placement="up" align="start" />
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
