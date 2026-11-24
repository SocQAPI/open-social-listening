import { cn } from "@/lib/ui/cn";

export type TermKind = "brand" | "competitor" | "keyword";
export type Sentiment = "positive" | "neutral" | "negative";

const kindStyle: Record<TermKind | "exclude", string> = {
  brand: "bg-chip-brand-bg text-chip-brand-fg",
  competitor: "bg-chip-comp-bg text-chip-comp-fg",
  keyword: "bg-chip-kw-bg text-chip-kw-fg",
  exclude: "bg-subtle text-ink-2 line-through",
};

export const kindLabel: Record<TermKind, string> = {
  brand: "Brand",
  competitor: "Competitor",
  keyword: "Topic",
};

export function TermChip({ kind, children, className }: { kind: TermKind | "exclude"; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-h-6 items-center rounded-md px-2 text-xs font-semibold", kindStyle[kind], className)}>
      {children}
    </span>
  );
}

const sentimentColor: Record<Sentiment, string> = {
  positive: "bg-pos",
  neutral: "bg-neu",
  negative: "bg-neg",
};

export const sentimentLabel: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

/** Colour never carries sentiment alone: the dot always sits next to its label. */
export function SentimentTag({ sentiment }: { sentiment: Sentiment | null | undefined }) {
  if (!sentiment) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", sentimentColor[sentiment])} />
      {sentimentLabel[sentiment]}
    </span>
  );
}

/** Platforms are marked with letters, never their logos. */
export const SOURCE_BADGES: Record<string, { badge: string; label: string }> = {
  reddit: { badge: "R", label: "Reddit" },
  x: { badge: "X", label: "X" },
  youtube: { badge: "YT", label: "YouTube" },
  tiktok: { badge: "TT", label: "TikTok" },
  instagram: { badge: "IG", label: "Instagram" },
  linkedin: { badge: "in", label: "LinkedIn" },
  threads: { badge: "Th", label: "Threads" },
  news: { badge: "N", label: "News" },
  web: { badge: "W", label: "Web" },
};

export function sourceLabel(id: string): string {
  return SOURCE_BADGES[id]?.label ?? id;
}

export function SourceBadge({ source, size = "sm", inverted = false }: { source: string; size?: "sm" | "md" | "lg"; inverted?: boolean }) {
  const meta = SOURCE_BADGES[source] ?? { badge: source.slice(0, 2).toUpperCase(), label: source };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold text-ink",
        inverted ? "bg-surface" : "bg-subtle",
        size === "sm" && "size-5 rounded-[5px] text-[9px]",
        size === "md" && "size-6 rounded-md text-[10px]",
        size === "lg" && "size-9 rounded-[9px] text-xs",
      )}
    >
      {meta.badge}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-surface px-1.5 font-mono text-[11px] text-ink-3">{children}</kbd>;
}
