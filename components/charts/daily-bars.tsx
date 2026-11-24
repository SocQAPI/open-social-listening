"use client";

import { useState } from "react";
import { cn } from "@/lib/ui/cn";
import { formatInt } from "@/lib/ui/format";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  count: number;
  topSource?: string | null;
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= v) return m * pow;
  }
  return 10 * pow;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const PLOT_H = 192;

/**
 * Single-series column chart: ≤24px columns, 4px rounded data end, square baseline,
 * hairline grid, the peak labelled, and a hover tooltip per column.
 */
export function DailyBars({ data, label }: { data: DailyPoint[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => d.count)));
  const peak = Math.max(...data.map((d) => d.count));
  const ticks = [max, max / 2, 0];
  const every = data.length > 10 ? 2 : 1;
  const cols = { gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` };

  return (
    <figure className="m-0">
      <div className="relative mt-3.5" style={{ height: PLOT_H + 44 }}>
        <div className="absolute inset-x-0 top-2 flex flex-col justify-between" style={{ height: PLOT_H }} aria-hidden="true">
          {ticks.map((t, i) => (
            <div key={t} className="flex items-center gap-2">
              <span className="tabular w-8 text-right text-xs text-ink-4">{formatInt(t)}</span>
              <span className={cn("h-px flex-1", i === ticks.length - 1 ? "bg-line-strong" : "bg-track")} />
            </div>
          ))}
        </div>
        <div className="absolute right-0 left-10 top-2 grid gap-x-0.5" style={{ ...cols, height: PLOT_H }} onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => {
            const h = Math.round((d.count / max) * PLOT_H);
            const active = hover === i;
            return (
              <div
                key={d.date}
                className="relative flex h-full flex-col items-center justify-end"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${shortDate(d.date)}: ${d.count} mentions`}
              >
                {d.count === peak && peak > 0 && !active && (
                  <span className="tabular mb-1 text-xs font-semibold text-ink">{formatInt(d.count)}</span>
                )}
                <div
                  className={cn(
                    "w-3/5 max-w-6 rounded-t origin-bottom transition-[height,background-color] duration-500 ease-out",
                    active ? "bg-brand-strong" : "bg-brand",
                  )}
                  style={{ height: Math.max(d.count > 0 ? 2 : 0, h) }}
                />
                {active && (
                  <div
                    role="tooltip"
                    className="animate-fade-in pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 -translate-y-1.5 whitespace-nowrap rounded-lg bg-ink px-2.5 py-2 text-xs leading-[1.45] text-white"
                  >
                    <div className="font-semibold">{shortDate(d.date)}</div>
                    <div className="tabular">
                      {formatInt(d.count)} mentions{d.topSource ? ` · top source ${d.topSource}` : ""}
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
      <details className="mt-1 text-[13px] text-ink-3">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <table className="tabular mt-2 w-full max-w-sm border-collapse">
          <thead>
            <tr className="text-left text-xs">
              <th scope="col" className="py-1 font-medium">Day</th>
              <th scope="col" className="py-1 text-right font-medium">Mentions</th>
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
