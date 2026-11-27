"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Check, ChevronDown, Inbox } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function Card({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "aside" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("rounded-[14px] border border-line bg-surface shadow-[0_1px_2px_rgba(23,24,28,0.04)]", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, meta, id }: { title: ReactNode; meta?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="m-0 text-[15px] font-semibold">
        {title}
      </h2>
      {meta && <span className="text-[13px] text-ink-3">{meta}</span>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton h-4", className)} />;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(function TextInput(
  { className, mono, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-11 rounded-[10px] border border-input bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-4",
        "transition-[border-color,box-shadow] duration-150 hover:border-[#b9b8b1] focus:border-ink focus:shadow-[0_0_0_3px_var(--color-accent-tint)] focus:outline-none",
        mono && "font-mono",
        className,
      )}
      {...rest}
    />
  );
});

/** Native select with the system arrow replaced, for places a popup menu would be clipped (table cells). */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative inline-flex">
      <select
        className={cn(
          "min-h-10 cursor-pointer appearance-none rounded-[10px] border border-line-strong bg-surface pr-8 pl-3 text-sm text-ink",
          "transition-[border-color,box-shadow,opacity] duration-150 hover:border-input focus:border-ink focus:shadow-[0_0_0_3px_var(--color-accent-tint)] focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-4" />
    </span>
  );
}

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  /** Small coloured dot before the label (Tailwind bg-* class). */
  dot?: string;
  /** Muted text after the label, e.g. a status. */
  note?: string;
  lang?: string;
}

/**
 * Button plus listbox menu, used instead of the native select wherever the menu has room to open.
 * It opens below the button, or above when there is not enough room underneath, and follows the
 * listbox keyboard pattern: arrows, Home/End, Enter/Space to choose, Escape to close.
 */
export function Dropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  icon,
  placement = "auto",
  align = "start",
  size = "md",
  className,
  buttonClassName,
  menuClassName,
  showLabel = false,
}: {
  /** Accessible name; also shown before the value when `showLabel` is set. */
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  icon?: ReactNode;
  placement?: "auto" | "up" | "down";
  align?: "start" | "end";
  size?: "sm" | "md" | "lg";
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(placement === "up");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // Only on open: `active` is the starting position here, later moves scroll themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openMenu = () => {
    if (placement === "auto" && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const needed = Math.min(320, options.length * 36 + 16);
      const below = window.innerHeight - rect.bottom;
      setUp(below < needed + 12 && rect.top > below);
    } else {
      setUp(placement === "up");
    }
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (next: T) => {
    if (next !== value) onChange(next);
    close(true);
  };
  const move = (next: number) => {
    setActive(next);
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu();
    }
  };
  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(active >= last ? 0 : active + 1),
      ArrowUp: () => move(active <= 0 ? last : active - 1),
      Home: () => move(0),
      End: () => move(last),
      Enter: () => choose(options[active].value),
      " ": () => choose(options[active].value),
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
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
        className={cn(
          "group inline-flex w-full cursor-pointer items-center border bg-surface text-left font-medium text-ink",
          "transition-[border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]",
          "focus-visible:shadow-[0_0_0_3px_var(--color-accent-tint)] focus-visible:outline-none",
          size === "sm" && "min-h-8 gap-1.5 rounded-lg px-2.5 text-xs",
          size === "md" && "min-h-10 gap-2 rounded-[10px] px-3 text-sm",
          size === "lg" && "min-h-11 gap-2 rounded-[10px] px-3 text-[15px] font-semibold",
          open ? "border-ink shadow-[0_0_0_3px_rgba(23,24,28,0.06)]" : "border-line-strong hover:border-input",
          buttonClassName,
        )}
      >
        {icon}
        {showLabel && <span className="font-normal text-ink-3">{label}</span>}
        {current?.dot && <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", current.dot)} />}
        <span lang={current?.lang} className="min-w-0 flex-1 truncate">
          {current?.label}
        </span>
        <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-ink-4 transition-transform duration-200 ease-out", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKeyDown}
          className={cn(
            "absolute z-50 m-0 max-h-80 min-w-full list-none overflow-y-auto rounded-xl border border-line bg-surface p-1 focus:outline-none",
            "shadow-[0_16px_40px_rgba(23,24,28,0.14),0_2px_6px_rgba(23,24,28,0.06)]",
            up ? "bottom-full mb-2 animate-pop-up" : "top-full mt-2 animate-pop-down",
            up ? (align === "end" ? "origin-bottom-right" : "origin-bottom-left") : align === "end" ? "origin-top-right" : "origin-top-left",
            align === "end" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={String(o.value)}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={selected}
                lang={o.lang}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                style={{ animationDelay: `${30 + Math.min(i, 8) * 20}ms` }}
                className={cn(
                  "animate-fade-in flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm whitespace-nowrap transition-colors duration-100",
                  i === active ? "bg-subtle text-ink" : "text-ink-2",
                  selected && "font-semibold text-ink",
                )}
              >
                {o.dot && <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", o.dot)} />}
                <span className="flex-1 truncate">{o.label}</span>
                {o.note && <span className="text-xs font-normal text-ink-4">{o.note}</span>}
                <Check
                  aria-hidden="true"
                  strokeWidth={2.4}
                  className={cn("size-4 shrink-0 text-accent transition-[opacity,transform] duration-200 ease-out", selected ? "scale-100 opacity-100" : "scale-50 opacity-0")}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * A number that counts to its new value (ease-out, about 0.7s) instead of jumping. Screen readers get the final
 * value straight away; the moving digits are hidden from them.
 */
export function CountUp({ value, format, duration = 700 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || start === value) {
      setShown(value);
      from.current = value;
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const next = p === 1 ? value : start + (value - start) * (1 - (1 - p) ** 3);
      setShown(next);
      from.current = next;
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  // While counting, whole targets move in whole steps and fractional ones (54.4 credits) in tenths; at rest the
  // exact value is formatted, so it matches the same number shown without animation elsewhere.
  const display = shown === value ? value : Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10;
  // `relative` keeps the absolutely positioned screen-reader copy inside scrolling containers (tables).
  return (
    <span className="relative">
      <span aria-hidden="true">{format(display)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-2 font-medium", className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-[13px] font-normal text-ink-3">{hint}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-[background-color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:shadow-[0_0_0_3px_var(--color-accent-tint)] focus-visible:outline-none",
        checked ? "bg-ink hover:bg-ink-2" : "bg-input hover:bg-[#c0bfb8]",
      )}
    >
      {/* The knob springs across and stretches a little while pressed, like a physical toggle. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]",
          "transition-[transform,width] duration-300 ease-[cubic-bezier(0.3,1.3,0.5,1)] group-active:w-[22px]",
          checked && "translate-x-4 group-active:translate-x-3",
        )}
      />
    </button>
  );
}

export function Meter({ value, max, label, thick = false }: { value: number; max: number; label: string; thick?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const over = max > 0 && value > max;
  return (
    <div role="img" aria-label={`${label}: ${pct} percent`} className={cn("overflow-hidden rounded-full bg-track", thick ? "h-2" : "h-1.5")}>
      <div
        className={cn("animate-reveal-x h-full rounded-full transition-[width,background-color] duration-500 ease-out", over ? "bg-accent-strong" : pct >= 85 ? "bg-accent" : "bg-ink")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Notice({ tone = "info", children, action }: { tone?: "info" | "warn" | "ok"; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "animate-rise flex flex-wrap items-center gap-3 rounded-[10px] px-3.5 py-3",
        tone === "info" && "bg-info-bg text-info-fg",
        tone === "warn" && "bg-accent-tint text-[#7a2e0e]",
        tone === "ok" && "bg-ok-bg text-ok-fg",
      )}
    >
      <div className="min-w-0 flex-[1_1_280px]">{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="animate-rise flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span aria-hidden="true" className="mb-2 inline-flex size-12 items-center justify-center rounded-2xl bg-subtle text-ink-3">
        {icon ?? <Inbox className="size-[22px]" strokeWidth={1.8} />}
      </span>
      <p className="m-0 font-semibold">{title}</p>
      {children && <p className="m-0 max-w-sm text-ink-3">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
