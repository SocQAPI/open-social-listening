import { eq } from "drizzle-orm";
import { alertChannels, projects } from "@/db/schema";
import { deliverAlert, testMessage } from "@/lib/alerts";
import { ensureReady } from "@/lib/bootstrap";
import { fail, json, parseId, type IdContext } from "@/lib/http";
import { errorMessage } from "@/lib/socq/errors";

export const dynamic = "force-dynamic";

/** POST /api/alerts/:id/test → { sent: true } or 502 { error: "delivery_failed", message } */
export async function POST(_request: Request, context: IdContext) {
  const id = parseId((await context.params).id);
  if (!id) return fail(400, "invalid_id");
  const db = await ensureReady();
  const channel = await db.select().from(alertChannels).where(eq(alertChannels.id, id)).get();
  if (!channel) return fail(404, "alert_not_found");
  const project = await db.select().from(projects).where(eq(projects.id, channel.projectId)).get();
  try {
    await deliverAlert(channel, testMessage({ id: channel.projectId, name: project?.name ?? "your project" }));
    return json({ sent: true });
  } catch (error) {
    return fail(502, "delivery_failed", { message: errorMessage(error) });
  }
}
