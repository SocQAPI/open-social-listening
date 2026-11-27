"use client";

import { useState } from "react";
import { cn } from "@/lib/ui/cn";
import { useI18n } from "@/lib/i18n";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  count: number;
  topSource?: string | null;
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  // Only steps whose half is a whole number, so the middle gridline reads cleanly.
  for (const m of [1, 2, 4, 6, 8, 10]) {
    if (m * pow >= v) return m * pow;
  }
  return 10 * pow;
}

function dayOf(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

const PLOT_H = 192;

/**
 * Single-series column chart: ≤24px columns, 4px rounded data end, square baseline,
 * hairline grid, the peak labelled, and a hover tooltip per column.
 */
export function DailyBars({ data, label }: { data: DailyPoint[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const { m, fmt } = useI18n();
  const shortDate = (iso: string) => fmt.shortDate(dayOf(iso));
  const formatInt = fmt.int;
  const max = niceMax(Math.max(1, ...data.map((d) => d.count)));
  const peak = Math.max(...data.map((d) => d.count));
  const ticks = [max, max / 2, 0];
  const every = data.length > 10 ? 2 : 1;
  const cols = { gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` };

  return (
    <figure className="m-0">
      <div className="relative mt-3.5" style={{ height: PLOT_H + 44 }}>
        <div className="absolute inset-x-0 top-2" style={{ height: PLOT_H }} aria-hidden="true">
          {ticks.map((t, i) => (
            // Centred on the exact value, so the baseline is where the columns end.
            <div key={t} className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2" style={{ top: `${(1 - t / max) * 100}%` }}>
              <span className="tabular w-8 text-right text-xs text-ink-4">{formatInt(t)}</span>
              <span className={cn("h-px flex-1", i === ticks.length - 1 ? "bg-line-strong" : "bg-track")} />
            </div>
          ))}
        </div>
        <div className="absolute right-0 left-10 top-2 grid gap-x-0.5" style={{ ...cols, gridTemplateRows: "minmax(0, 1fr)", height: PLOT_H }} onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => {
            const h = Math.round((d.count / max) * PLOT_H);
            const active = hover === i;
            return (
              <div
                key={d.date}
                className="relative flex h-full cursor-default flex-col items-center justify-end focus-visible:outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={m.chart.mentionsOn(shortDate(d.date), d.count)}
              >
                {/* A soft band behind the hovered day makes the target obvious without a crosshair. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-0 left-1/2 w-[85%] max-w-12 -translate-x-1/2 rounded-md bg-subtle transition-opacity duration-150",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                {d.count === peak && peak > 0 && !active && (
                  // Out of the flow: a label inside the column would make it taller than the plot and push every column down.
                  <span
                    className="animate-fade-in tabular absolute left-1/2 -translate-x-1/2 text-xs font-semibold text-ink"
                    style={{ bottom: Math.max(2, h) + 4, animationDelay: `${Math.min(500, data.length * 25 + 300)}ms` }}
                  >
                    {formatInt(d.count)}
                  </span>
                )}
                <div
                  className={cn(
                    "animate-grow-y relative w-3/5 max-w-6 origin-bottom rounded-t transition-[height,background-color] duration-500 ease-out",
                    active ? "bg-brand-strong" : hover !== null ? "bg-brand/70" : "bg-brand",
                  )}
                  style={{ height: Math.max(d.count > 0 ? 2 : 0, h), animationDelay: `${i * 25}ms` }}
                />
                {active && (
                  <div
                    role="tooltip"
                    className="animate-pop-up pointer-events-none absolute left-1/2 z-10 origin-bottom -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-2 text-xs leading-[1.45] text-white shadow-[0_8px_20px_rgba(23,24,28,0.2)]"
                    // Just above the hovered column rather than at the top of the plot.
                    style={{ bottom: Math.max(2, h) + 8 }}
                  >
                    <div className="font-semibold">{shortDate(d.date)}</div>
                    <div className="tabular">
                      {m.chart.mentionsCount(formatInt(d.count))}{d.topSource ? m.chart.topSource(d.topSource) : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="absolute right-0 left-10 grid gap-x-0.5" style={{ ...cols, top: PLOT_H + 18 }} aria-hidden="true">
          {data.map((d, i) => (
            <span key={d.date} className="text-center text-xs whitespace-nowrap text-ink-4">
              {i % every === (data.length - 1) % every ? shortDate(d.date) : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">{label}</figcaption>
      <details className="group/table mt-1 text-[13px] text-ink-3">
        <summary className="cursor-pointer select-none transition-colors hover:text-ink">{m.chart.showAsTable}</summary>
        <table className="tabular animate-rise mt-2 w-full max-w-sm border-collapse">
          <thead>
            <tr className="text-left text-xs">
              <th scope="col" className="py-1 font-medium">{m.chart.day}</th>
              <th scope="col" className="py-1 text-right font-medium">{m.chart.mentions}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-track">
                <td className="py-1">{shortDate(d.date)}</td>
                <td className="py-1 text-right">{formatInt(d.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
