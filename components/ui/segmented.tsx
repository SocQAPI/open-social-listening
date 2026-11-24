"use client";

import { cn } from "@/lib/ui/cn";

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedProps<T extends string | number> {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Pill group on a sunken track; the active option lifts onto a white chip. */
export function Segmented<T extends string | number>({ label, options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-track p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-9 cursor-pointer rounded-[9px] px-3.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-150",
              active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(23,24,28,0.12)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="tabular ml-1.5 opacity-70">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
