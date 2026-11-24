import { eq } from "drizzle-orm";
import { mentions } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { toMentionDTO } from "@/lib/dto";
import { fail, invalid, json, parseId, readJson, type IdContext } from "@/lib/http";
import { mentionUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PATCH /api/mentions/:id { starred?, read? } → MentionDTO */
export async function PATCH(request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const parsed = mentionUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const db = await ensureReady();
  const patch: { starred?: boolean; read?: boolean } = {};
  if (parsed.data.starred !== undefined) patch.starred = parsed.data.starred;
  if (parsed.data.read !== undefined) patch.read = parsed.data.read;
  const [row] = await db.update(mentions).set(patch).where(eq(mentions.id, id)).returning();
  if (!row) return fail(404, "mention_not_found");
  return json(toMentionDTO(row));
}
