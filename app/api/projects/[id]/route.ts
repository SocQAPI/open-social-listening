import { eq } from "drizzle-orm";
import { alertChannels, mentions, projects, runs, sourceTasks } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { toProjectDTO } from "@/lib/dto";
import { fail, invalid, json, parseId, readJson, type IdContext } from "@/lib/http";
import { projectUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/projects/:id → ProjectDTO */
export async function GET(_request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const db = await ensureReady();
  const row = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!row) return fail(404, "project_not_found");
  return json(toProjectDTO(row));
}

/**
 * PATCH /api/projects/:id — any subset of the create fields plus `paused`.
 * Pausing sets paused_reason "manual"; resuming clears it. Sources merge per id.
 */
export async function PATCH(request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const parsed = projectUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const db = await ensureReady();
  const current = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!current) return fail(404, "project_not_found");

  const { paused, sources, ...rest } = parsed.data;
  const patch: Partial<typeof projects.$inferInsert> = { ...rest };
  if (sources) patch.sources = { ...current.sources, ...sources };
  if (paused !== undefined) {
    patch.paused = paused;
    patch.pausedReason = paused ? "manual" : null;
  }
  const next = { ...current, ...patch };
  if (!next.brandTerms.length && !next.keywords.length && !next.competitors.length) {
    return fail(400, "invalid_request", { issues: [{ path: "brandTerms", message: "Add at least one brand term, keyword or competitor" }] });
  }
  if (Object.keys(patch).length) {
    await db.update(projects).set(patch).where(eq(projects.id, id));
  }
  const row = await db.select().from(projects).where(eq(projects.id, id)).get();
  return json(toProjectDTO(row ?? current));
}

/** DELETE /api/projects/:id → 204; removes its mentions, runs, tasks and alert channels. */
export async function DELETE(_request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const db = await ensureReady();
  const row = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get();
  if (!row) return fail(404, "project_not_found");
  const runIds = (await db.select({ id: runs.id }).from(runs).where(eq(runs.projectId, id))).map((run) => run.id);
  await db.transaction(async (tx) => {
    for (const runId of runIds) await tx.delete(sourceTasks).where(eq(sourceTasks.runId, runId));
    await tx.delete(runs).where(eq(runs.projectId, id));
    await tx.delete(mentions).where(eq(mentions.projectId, id));
    await tx.delete(alertChannels).where(eq(alertChannels.projectId, id));
    await tx.delete(projects).where(eq(projects.id, id));
  });
  return new Response(null, { status: 204 });
}
