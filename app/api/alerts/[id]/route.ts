import { eq } from "drizzle-orm";
import { alertChannels } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { toAlertDTO } from "@/lib/dto";
import { fail, invalid, json, parseId, readJson, type IdContext } from "@/lib/http";
import { alertCreateSchema, alertUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PATCH /api/alerts/:id { target?, enabled?, spikeMultiplier? } → AlertDTO */
export async function PATCH(request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const parsed = alertUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const db = await ensureReady();
  const current = await db.select().from(alertChannels).where(eq(alertChannels.id, id)).get();
  if (!current) return fail(404, "alert_not_found");

  if (parsed.data.target !== undefined) {
    // Re-validate the target against the channel kind (URL vs email).
    const check = alertCreateSchema.safeParse({ kind: current.kind, target: parsed.data.target });
    if (!check.success) return invalid(check.error);
  }
  const patch: Partial<typeof alertChannels.$inferInsert> = {};
  if (parsed.data.target !== undefined) patch.target = parsed.data.target;
  if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
  if (parsed.data.spikeMultiplier !== undefined) patch.spikeMultiplier = parsed.data.spikeMultiplier;
  if (Object.keys(patch).length) await db.update(alertChannels).set(patch).where(eq(alertChannels.id, id));
  const row = await db.select().from(alertChannels).where(eq(alertChannels.id, id)).get();
  return json(toAlertDTO(row ?? current));
}

/** DELETE /api/alerts/:id → 204 */
export async function DELETE(_request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const db = await ensureReady();
  await db.delete(alertChannels).where(eq(alertChannels.id, id));
  return new Response(null, { status: 204 });
}
