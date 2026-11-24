import { and, eq } from "drizzle-orm";
import { projects } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { runProject } from "@/lib/runner";
import { getApiKey } from "@/lib/settings";
import { errorMessage } from "@/lib/socq/errors";

const TICK_MS = 60_000;
const FIRST_TICK_MS = 5_000;

interface SchedulerState {
  started: boolean;
  ticking: boolean;
}

/** Let the process exit even while timers are pending (Node timers expose `unref`). */
function unref(handle: unknown): void {
  (handle as { unref?: () => void } | null)?.unref?.();
}

const globalState = globalThis as typeof globalThis & { __oslScheduler?: SchedulerState };

export function isDue(lastRunAt: string | null, intervalMinutes: number, now = Date.now()): boolean {
  if (!lastRunAt) return true;
  const last = Date.parse(lastRunAt);
  if (Number.isNaN(last)) return true;
  return now - last >= intervalMinutes * 60_000;
}

/** Check every minute for projects whose interval has elapsed and run them one at a time. */
export function startScheduler(): void {
  const state = (globalState.__oslScheduler ??= { started: false, ticking: false });
  if (state.started) return;
  state.started = true;
  unref(setTimeout(() => void tick(state), FIRST_TICK_MS));
  unref(setInterval(() => void tick(state), TICK_MS));
  console.log("[open-social-listening] scheduler started");
}

async function tick(state: SchedulerState): Promise<void> {
  if (state.ticking) return;
  state.ticking = true;
  try {
    const db = await ensureReady();
    if (!(await getApiKey(db))) return;
    const candidates = await db
      .select()
      .from(projects)
      .where(and(eq(projects.paused, false), eq(projects.isDemo, false)));
    for (const project of candidates) {
      if (!isDue(project.lastRunAt, project.intervalMinutes)) continue;
      const summary = await runProject(project.id);
      if (summary.status !== "skipped") {
        console.log(
          `[open-social-listening] project ${project.id} run ${summary.runId}: ${summary.status}, ` +
            `${summary.newMentions} new, ${summary.creditsUsed} credits`,
        );
      }
    }
  } catch (error) {
    console.error("[open-social-listening] scheduler tick failed:", errorMessage(error));
  } finally {
    state.ticking = false;
  }
}
