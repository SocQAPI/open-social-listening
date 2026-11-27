"use client";

import { useLayoutEffect, useRef, useState } from "react";
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

/**
 * Pill group on a sunken track. A single white chip slides under the active option, so a change reads as
 * movement rather than one chip disappearing and another appearing.
 */
export function Segmented<T extends string | number>({ label, options, value, onChange, className }: SegmentedProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [chip, setChip] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // No slide for the first placement, or the chip would fly in from the corner.
  const [animate, setAnimate] = useState(false);
  const index = options.findIndex((o) => o.value === value);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const place = () => {
      const button = track.querySelectorAll<HTMLButtonElement>("button")[index];
      if (!button) return setChip(null);
      setChip({ x: button.offsetLeft, y: button.offsetTop, w: button.offsetWidth, h: button.offsetHeight });
    };
    place();
    // Labels change width with the language, the counts and the web font arriving.
    const observer = new ResizeObserver(place);
    observer.observe(track);
    track.querySelectorAll("button").forEach((b) => observer.observe(b));
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(id);
    };
  }, [index, options.length]);

  return (
    <div ref={trackRef} role="group" aria-label={label} className={cn("relative inline-flex flex-wrap gap-1 rounded-xl bg-track p-1", className)}>
      {chip && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-0 left-0 rounded-[9px] bg-surface shadow-[0_1px_2px_rgba(23,24,28,0.12),0_1px_1px_rgba(23,24,28,0.04)]",
            animate && "transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.3,1.15,0.5,1)]",
          )}
          style={{ width: chip.w, height: chip.h, transform: `translate(${chip.x}px, ${chip.y}px)` }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative min-h-9 cursor-pointer rounded-[9px] px-3.5 text-sm font-medium transition-[color,transform] duration-150 active:scale-[0.97]",
              active ? "text-ink" : "text-ink-2 hover:text-ink",
              // Before the chip is measured, the active option keeps its own background.
              active && !chip && "bg-surface shadow-[0_1px_2px_rgba(23,24,28,0.12)]",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <>
                {" "}
                <span className={cn("tabular ml-1 transition-opacity", active ? "opacity-70" : "opacity-60")}>{o.count}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
