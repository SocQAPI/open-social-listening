"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { TermKind } from "./tokens";

const chipStyle: Record<TermKind | "exclude", string> = {
  brand: "bg-chip-brand-bg text-chip-brand-fg",
  competitor: "bg-chip-comp-bg text-chip-comp-fg",
  keyword: "bg-chip-kw-bg text-chip-kw-fg",
  exclude: "bg-subtle text-ink-2",
};

interface TermEditorProps {
  kind: TermKind | "exclude";
  title: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max?: number;
}

/** Chips with remove buttons plus an input that adds on Enter, comma or the Add button. */
export function TermEditor({ kind, title, hint, values, onChange, placeholder, max = 20 }: TermEditorProps) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const hintId = useId();

  const add = (raw: string = draft) => {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const lower = new Set(values.map((v) => v.toLowerCase()));
    const next = [...values];
    for (const p of parts) {
      if (!lower.has(p.toLowerCase()) && next.length < max) {
        next.push(p.slice(0, 100));
        lower.add(p.toLowerCase());
      }
    }
    onChange(next);
    setDraft("");
  };

  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className="mb-0.5 p-0 font-medium">{title}</legend>
      {hint && (
        <span id={hintId} className="text-[13px] text-ink-3">
          {hint}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {values.map((v, i) => (
          <span key={`${v}-${i}`} className={cn("animate-fade-in inline-flex min-h-9 items-center gap-0.5 rounded-[9px] pl-3 pr-1 text-sm font-medium", chipStyle[kind])}>
            <span className={kind === "exclude" ? "line-through" : undefined}>{v}</span>
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              aria-label={`Remove ${v}`}
              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100"
            >
              <X aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
            </button>
          </span>
        ))}
        <label htmlFor={inputId} className="sr-only">
          {`Add to ${title}`}
        </label>
        <input
          id={inputId}
          type="text"
          value={draft}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => add()}
          placeholder={placeholder}
          className="min-h-9 w-48 rounded-[9px] border border-dashed border-[#bdbcb5] bg-surface px-3 text-sm text-ink placeholder:text-ink-4 focus:border-solid focus:border-ink focus:outline-none"
        />
      </div>
    </fieldset>
  );
}
