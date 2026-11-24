import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { mentions } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { invalid, json, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.number().int().positive(),
  /** Omit to mark every mention of the project as read. */
  ids: z.array(z.number().int().positive()).max(1000).optional(),
});

/** POST /api/mentions/mark-read { projectId, ids? } → { updated: number } */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, ids } = parsed.data;
  const db = await ensureReady();
  const where = ids?.length
    ? and(eq(mentions.projectId, projectId), inArray(mentions.id, ids))
    : and(eq(mentions.projectId, projectId), eq(mentions.read, false));
  const updated = await db.update(mentions).set({ read: true }).where(where).returning({ id: mentions.id });
  return json({ updated: updated.length });
}
