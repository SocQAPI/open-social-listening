import type { Competitor, TermSpec } from "@/lib/types";
import type { MentionInput } from "@/lib/sources/types";

export interface TermSource {
  brandTerms: string[];
  keywords: string[];
  competitors: Competitor[];
}

/** Every search term of a project, tagged with what it tracks. Duplicates (case-insensitive) keep the first tag. */
export function expandTerms(project: TermSource): TermSpec[] {
  const seen = new Set<string>();
  const out: TermSpec[] = [];
  const push = (raw: string, kind: TermSpec["kind"], competitorName: string | null) => {
    const term = raw.trim();
    if (!term) return;
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ term, kind, competitorName });
  };
  for (const term of project.brandTerms) push(term, "brand", null);
  for (const competitor of project.competitors) {
    for (const term of competitor.terms) push(term, "competitor", competitor.name);
  }
  for (const term of project.keywords) push(term, "keyword", null);
  return out;
}

/** True when the mention contains any exclude term (case-insensitive) in its title, text or author handle. */
export function isExcluded(mention: Pick<MentionInput, "title" | "text" | "authorHandle">, excludeTerms: string[]): boolean {
  const needles = excludeTerms.map((term) => term.trim().toLowerCase()).filter(Boolean);
  if (!needles.length) return false;
  const haystack = `${mention.title ?? ""} ${mention.text ?? ""} ${mention.authorHandle ?? ""}`.toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Terms that are one plain word ("Obsidian", "Linear"). Searches for them also return posts about the
 * everyday meaning, so the UI nudges for a more specific variant and exclude terms. Handles, domains,
 * multi-word names and names with digits are specific enough already.
 */
export function broadTerms(terms: string[]): string[] {
  return terms.map((term) => term.trim()).filter((term) => /^\p{L}+$/u.test(term));
}
