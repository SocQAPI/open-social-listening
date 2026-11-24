"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export function Card({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "aside" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("rounded-[14px] border border-line bg-surface", className)} {...rest}>
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
        "transition-[border-color,box-shadow] duration-150 focus:border-ink focus:shadow-[0_0_0_3px_var(--color-accent-tint)] focus:outline-none",
        mono && "font-mono",
        className,
      )}
      {...rest}
    />
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-10 cursor-pointer rounded-[10px] border border-line-strong bg-surface px-2.5 text-sm text-ink",
        "focus:border-ink focus:outline-none",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
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
        "relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-ink" : "bg-input",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[3px] left-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-out",
          checked && "translate-x-4",
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
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", over ? "bg-accent-strong" : pct >= 85 ? "bg-accent" : "bg-ink")}
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
        "animate-fade-in flex flex-wrap items-center gap-3 rounded-[10px] px-3.5 py-3",
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

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="m-0 font-semibold">{title}</p>
      {children && <p className="m-0 max-w-sm text-ink-3">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
