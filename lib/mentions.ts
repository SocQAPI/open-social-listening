import type { Db } from "@/db/client";
import { mentions, type NewMentionRow } from "@/db/schema";
import type { MentionInput, SourceId } from "@/lib/sources/types";
import type { TermSpec } from "@/lib/types";

/** Build an insertable row from a mapped mention and the term that found it. */
export function toMentionRow(projectId: number, source: SourceId, term: TermSpec, input: MentionInput, now = new Date()): NewMentionRow {
  const createdAt = now.toISOString();
  return {
    projectId,
    source,
    platform: input.platform,
    externalId: input.externalId,
    url: input.url,
    title: input.title,
    text: input.text,
    authorName: input.authorName,
    authorHandle: input.authorHandle,
    authorUrl: input.authorUrl,
    authorAvatar: input.authorAvatar,
    publishedAt: input.publishedAt,
    collectedAt: input.collectedAt,
    sortAt: sortableTimestamp(input.publishedAt) ?? sortableTimestamp(input.collectedAt) ?? createdAt,
    metrics: input.metrics,
    matchedTerm: term.term,
    termKind: term.kind,
    competitorName: term.competitorName,
    sentiment: input.sentiment,
    starred: false,
    read: false,
    createdAt,
  };
}

function sortableTimestamp(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/** Insert rows, skipping URLs the project already has. Returns the ids actually inserted. */
export async function insertMentions(db: Db, rows: NewMentionRow[]): Promise<number[]> {
  const inserted: number[] = [];
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    if (!chunk.length) continue;
    const result = await db.insert(mentions).values(chunk).onConflictDoNothing().returning({ id: mentions.id });
    for (const row of result) inserted.push(row.id);
  }
  return inserted;
}
