import { eq } from "drizzle-orm";
import { projects } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { fail, json, parseId, type IdContext } from "@/lib/http";
import { isRunning, runProject } from "@/lib/runner";
import { getApiKey } from "@/lib/settings";
import { errorMessage } from "@/lib/socq/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/:id/run → 202 { started: true }.
 * The run continues in the background; poll GET /api/projects/:id (`running`, `lastRunAt`) or /api/stats.
 * 409 errors: demo_project | no_api_key | already_running.
 */
export async function POST(_request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const db = await ensureReady();
  const project = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return fail(404, "project_not_found");
  if (project.isDemo) return fail(409, "demo_project");
  if (!(await getApiKey(db))) return fail(409, "no_api_key");
  if (isRunning(id)) return fail(409, "already_running");

  // Manual runs ignore the schedule and the paused flag but still respect the monthly budget.
  void runProject(id).catch((error: unknown) => {
    console.error(`[open-social-listening] manual run of project ${id} failed:`, errorMessage(error));
  });
  return json({ started: true }, 202);
}
