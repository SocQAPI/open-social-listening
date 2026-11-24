import { and, desc } from "drizzle-orm";
import { mentions } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { toMentionDTO } from "@/lib/dto";
import { fail, json, parseId } from "@/lib/http";
import { afterCursor, decodeCursor, encodeCursor, filtersFromSearchParams, mentionConditions } from "@/lib/mention-query";

export const dynamic = "force-dynamic";

/**
 * GET /api/mentions?projectId=1[&source=reddit,x][&termKind=brand|competitor|keyword][&competitor=Name]
 *   [&sentiment=positive|neutral|negative][&starred=1][&unread=1][&q=text][&from=YYYY-MM-DD][&to=YYYY-MM-DD]
 *   [&cursor=…][&limit=50]
 * → { items: MentionDTO[], nextCursor: string | null }, newest first.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectId = parseId(params.get("projectId"));
  if (!projectId) return fail(400, "project_id_required");
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200);
  const cursor = decodeCursor(params.get("cursor"));
  if (params.get("cursor") && !cursor) return fail(400, "invalid_cursor");

  const db = await ensureReady();
  const base = mentionConditions(filtersFromSearchParams(params, projectId));
  const rows = await db
    .select()
    .from(mentions)
    .where(cursor ? and(base, afterCursor(cursor)) : base)
    .orderBy(desc(mentions.sortAt), desc(mentions.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return json({
    items: page.map(toMentionDTO),
    nextCursor: rows.length > limit && last ? encodeCursor({ sortAt: last.sortAt, id: last.id }) : null,
  });
}
