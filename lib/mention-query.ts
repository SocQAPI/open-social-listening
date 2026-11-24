import { and, eq, gte, inArray, lt, lte, or, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { mentions } from "@/db/schema";
import type { Sentiment, TermKind } from "@/lib/types";

export interface MentionFilters {
  projectId: number;
  sources?: string[];
  termKind?: TermKind;
  competitor?: string;
  sentiment?: Sentiment;
  starred?: boolean;
  unread?: boolean;
  q?: string;
  from?: string;
  to?: string;
}

const TERM_KINDS: TermKind[] = ["brand", "competitor", "keyword"];
const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];

/**
 * Read filters from query params: projectId, source (repeatable or comma-separated), termKind,
 * competitor, sentiment, starred=1, unread=1, q, from, to (YYYY-MM-DD or ISO).
 */
export function filtersFromSearchParams(params: URLSearchParams, projectId: number): MentionFilters {
  const sources = params
    .getAll("source")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const termKind = params.get("termKind");
  const sentiment = params.get("sentiment");
  return {
    projectId,
    sources: sources.length ? sources : undefined,
    termKind: TERM_KINDS.includes(termKind as TermKind) ? (termKind as TermKind) : undefined,
    competitor: params.get("competitor")?.trim() || undefined,
    sentiment: SENTIMENTS.includes(sentiment as Sentiment) ? (sentiment as Sentiment) : undefined,
    starred: params.get("starred") === "1" || params.get("starred") === "true" ? true : undefined,
    unread: params.get("unread") === "1" || params.get("unread") === "true" ? true : undefined,
    q: params.get("q")?.trim() || undefined,
    from: params.get("from")?.trim() || undefined,
    to: params.get("to")?.trim() || undefined,
  };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function mentionConditions(filters: MentionFilters): SQL {
  const conditions: SQL[] = [eq(mentions.projectId, filters.projectId)];
  if (filters.sources?.length) conditions.push(inArray(mentions.source, filters.sources));
  if (filters.termKind) conditions.push(eq(mentions.termKind, filters.termKind));
  if (filters.competitor) conditions.push(eq(mentions.competitorName, filters.competitor));
  if (filters.sentiment) conditions.push(eq(mentions.sentiment, filters.sentiment));
  if (filters.starred) conditions.push(eq(mentions.starred, true));
  if (filters.unread) conditions.push(eq(mentions.read, false));
  if (filters.from) {
    conditions.push(gte(mentions.sortAt, DATE_ONLY.test(filters.from) ? `${filters.from}T00:00:00.000Z` : filters.from));
  }
  if (filters.to) {
    conditions.push(lte(mentions.sortAt, DATE_ONLY.test(filters.to) ? `${filters.to}T23:59:59.999Z` : filters.to));
  }
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    const like = (column: AnySQLiteColumn) => sql`${column} LIKE ${pattern} ESCAPE '\\'`;
    conditions.push(or(like(mentions.title), like(mentions.text), like(mentions.authorName), like(mentions.authorHandle))!);
  }
  return and(...conditions)!;
}

export interface Cursor {
  sortAt: string;
  id: number;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify([cursor.sortAt, cursor.id])).toString("base64url");
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const [sortAt, id] = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as [unknown, unknown];
    if (typeof sortAt !== "string" || typeof id !== "number") return null;
    return { sortAt, id };
  } catch {
    return null;
  }
}

/** Keyset condition for "older than the cursor" under ORDER BY sort_at DESC, id DESC. */
export function afterCursor(cursor: Cursor): SQL {
  return or(lt(mentions.sortAt, cursor.sortAt), and(eq(mentions.sortAt, cursor.sortAt), lt(mentions.id, cursor.id)))!;
}
