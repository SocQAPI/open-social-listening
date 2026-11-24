"use client";

import { useState } from "react";
import { cn } from "@/lib/ui/cn";
import { formatInt } from "@/lib/ui/format";

export interface ShareSegment {
  key: string;
  label: string;
  value: number;
  /** Tailwind bg-* class for the mark (data colour). */
  color: string;
}

/**
 * 100% stacked bar: 2px surface gaps between segments, 4px rounded outer ends,
 * legend always present and values in text (aqua is below 3:1, so labels are required).
 */
export function StackedShare({ segments, label }: { segments: ShareSegment[]; label: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const description = segments.map((s) => `${s.label} ${pct(s.value)} percent`).join(", ");

  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={`${label}: ${description}`} className="flex h-6 gap-0.5">
        {total === 0 ? (
          <div className="h-6 flex-1 rounded bg-track" />
        ) : (
          visible.map((s, i) => (
            <div
              key={s.key}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                "relative h-6 transition-[flex-grow,opacity] duration-500 ease-out",
                s.color,
                i === 0 && "rounded-l",
                i === visible.length - 1 && "rounded-r",
                hover && hover !== s.key && "opacity-60",
              )}
              style={{ flexGrow: s.value, flexBasis: 0 }}
            >
              {hover === s.key && (
                <div role="tooltip" className="animate-fade-in pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 -translate-y-1.5 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white">
                  <span className="font-semibold">{s.label}</span> · <span className="tabular">{formatInt(s.value)} ({pct(s.value)}%)</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px] text-ink-2">
        {segments.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", s.color)} />
            {s.label}
            <strong className="tabular">{formatInt(s.value)}</strong>
            <span className="tabular text-ink-4">{pct(s.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal single-hue bars with the category name on the left and value at the tip. */
export function HBars({ rows, colorClass = "bg-brand" }: { rows: { key: string; label: string; value: number }[]; colorClass?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[88px_minmax(0,1fr)_44px] items-center gap-2.5">
          <span className="truncate text-[13px] text-ink-2">{r.label}</span>
          <span className="flex h-5 items-center">
            <span
              className={cn("h-4 rounded-r transition-[width] duration-500 ease-out", colorClass)}
              style={{ width: `${Math.max(r.value > 0 ? 2 : 0, Math.round((r.value / max) * 100))}%` }}
            />
          </span>
          <span className="tabular text-right text-[13px] font-semibold">{formatInt(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}
