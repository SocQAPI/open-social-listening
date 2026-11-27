// Number, date and relative-time formatting follows the interface language: see `fmt` from useI18n().

/** 1 SocQ credit = $0.005 */
export function creditsToUsd(credits: number): string {
  return `$${(credits * 0.005).toFixed(2)}`;
}

/** Splits text around the first case-insensitive occurrence of term, for <mark> highlighting. */
export function splitHighlight(text: string, term: string | null | undefined): [string, string, string] {
  if (!term) return [text, "", ""];
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return [text, "", ""];
  return [text.slice(0, i), text.slice(i, i + term.length), text.slice(i + term.length)];
}
