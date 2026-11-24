import { eq } from "drizzle-orm";
import { alertChannels, projects } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { toAlertDTO } from "@/lib/dto";
import { fail, invalid, json, parseId, readJson, type IdContext } from "@/lib/http";
import { alertCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/projects/:id/alerts → { items: AlertDTO[] } */
export async function GET(_request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const db = await ensureReady();
  const rows = await db.select().from(alertChannels).where(eq(alertChannels.projectId, id)).orderBy(alertChannels.createdAt);
  return json({ items: rows.map(toAlertDTO) });
}

/** POST /api/projects/:id/alerts { kind, target, enabled?, spikeMultiplier? } → 201 AlertDTO */
export async function POST(request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const parsed = alertCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const db = await ensureReady();
  const project = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get();
  if (!project) return fail(404, "project_not_found");
  const [row] = await db
    .insert(alertChannels)
    .values({
      projectId: id,
      kind: parsed.data.kind,
      target: parsed.data.target,
      enabled: parsed.data.enabled ?? true,
      spikeMultiplier: parsed.data.spikeMultiplier ?? 3,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return json(toAlertDTO(row), 201);
}
