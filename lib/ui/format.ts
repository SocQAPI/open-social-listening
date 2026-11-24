const intFmt = new Intl.NumberFormat("en-US");
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return intFmt.format(Math.round(n));
}

export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n < 10_000 ? intFmt.format(n) : compactFmt.format(n);
}

/** 1 SocQ credit = $0.005 */
export function creditsToUsd(credits: number): string {
  return `$${(credits * 0.005).toFixed(2)}`;
}

export function formatCredits(credits: number | null | undefined): string {
  if (credits === null || credits === undefined) return "—";
  return `${formatInt(credits)} cr`;
}

export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Splits text around the first case-insensitive occurrence of term, for <mark> highlighting. */
export function splitHighlight(text: string, term: string | null | undefined): [string, string, string] {
  if (!term) return [text, "", ""];
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return [text, "", ""];
  return [text.slice(0, i), text.slice(i, i + term.length), text.slice(i + term.length)];
}
