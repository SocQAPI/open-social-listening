import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { projects, runs, sourceTasks, type NewMentionRow, type ProjectRow } from "@/db/schema";
import { maybeSendSpikeAlert } from "@/lib/alerts";
import { ensureReady } from "@/lib/bootstrap";
import { estimateRunCredits } from "@/lib/cost";
import { insertMentions, toMentionRow } from "@/lib/mentions";
import { runPool } from "@/lib/pool";
import { getApiKey } from "@/lib/settings";
import { SocqAuthError, SocqClient, errorMessage, isFatalSocqError } from "@/lib/socq";
import { enabledSources, windowForInterval } from "@/lib/sources";
import { expandTerms, isExcluded } from "@/lib/terms";
import type { PausedReason, RunStatus } from "@/lib/types";

export type RunSkipReason = "demo" | "no_api_key" | "nothing_to_run" | "budget" | "already_running";

export interface RunSummary {
  runId: number | null;
  status: RunStatus | "skipped";
  creditsUsed: number;
  newMentions: number;
  reason?: RunSkipReason;
  error?: string;
}

const CONCURRENCY = 4;

// Projects with a run in flight, shared by the scheduler and the manual "Run now" button.
const globalState = globalThis as typeof globalThis & { __oslActiveRuns?: Set<number> };
const activeRuns = (globalState.__oslActiveRuns ??= new Set<number>());

export function isRunning(projectId: number): boolean {
  return activeRuns.has(projectId);
}

export function startOfMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function creditsUsedThisMonth(db: Db, projectId: number, now = new Date()): Promise<number> {
  const row = await db
    .select({ total: sql<number>`coalesce(sum(${runs.creditsUsed}), 0)` })
    .from(runs)
    .where(and(eq(runs.projectId, projectId), gte(runs.startedAt, startOfMonthIso(now))))
    .get();
  return Number(row?.total ?? 0);
}

export async function pauseProject(db: Db, projectId: number, reason: PausedReason): Promise<void> {
  await db.update(projects).set({ paused: true, pausedReason: reason }).where(eq(projects.id, projectId));
}

function skipped(reason: RunSkipReason): RunSummary {
  return { runId: null, status: "skipped", creditsUsed: 0, newMentions: 0, reason };
}

/**
 * Search every enabled source for every term of the project, store new mentions and send spike alerts.
 * A 401 pauses the project with reason `auth`, a 402 with `credits`; other per-task errors are recorded and skipped.
 */
export async function runProject(projectId: number): Promise<RunSummary> {
  if (activeRuns.has(projectId)) return skipped("already_running");
  activeRuns.add(projectId);
  try {
    const db = await ensureReady();
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) throw new Error("project_not_found");
    return await execute(db, project);
  } finally {
    activeRuns.delete(projectId);
  }
}

async function execute(db: Db, project: ProjectRow): Promise<RunSummary> {
  if (project.isDemo) return skipped("demo");
  const apiKey = await getApiKey(db);
  if (!apiKey) return skipped("no_api_key");

  const terms = expandTerms(project);
  const plan = enabledSources(project.sources);
  if (!terms.length || !plan.length) return skipped("nothing_to_run");

  const estimate = estimateRunCredits(project).total;
  if (project.monthlyBudgetCredits > 0) {
    const used = await creditsUsedThisMonth(db, project.id);
    if (used + estimate > project.monthlyBudgetCredits) {
      await pauseProject(db, project.id, "budget");
      return skipped("budget");
    }
  }

  const startedAt = new Date().toISOString();
  const [run] = await db.insert(runs).values({ projectId: project.id, startedAt, status: "running" }).returning({ id: runs.id });
  const client = new SocqClient({ apiKey });
  const window = windowForInterval(project.intervalMinutes);
  const jobs = plan.flatMap(({ source, resultsLimit }) => terms.map((term) => ({ source, resultsLimit, term })));

  let fatal: unknown = null;
  let creditsUsed = 0;
  let failures = 0;
  const newIds: number[] = [];

  await runPool(jobs, CONCURRENCY, async ({ source, resultsLimit, term }) => {
    if (fatal) return;
    const [task] = await db
      .insert(sourceTasks)
      .values({ runId: run.id, source: source.id, term: term.term, status: "submitting" })
      .returning({ id: sourceTasks.id });
    try {
      const submitted = await client.submit(source.endpoint, source.buildInput(term.term, { resultsLimit, window }));
      await db.update(sourceTasks).set({ taskId: submitted.task_id, status: "running" }).where(eq(sourceTasks.id, task.id));
      const finished = await client.waitForTask(submitted.task_id);

      const rows: NewMentionRow[] = [];
      for await (const item of client.iterateResults(finished)) {
        const mention = source.map(item);
        if (!mention || isExcluded(mention, project.excludeTerms)) continue;
        rows.push(toMentionRow(project.id, source.id, term, mention));
      }
      const inserted = await insertMentions(db, rows);
      const credits = Number(finished.credits_amount ?? 0);
      creditsUsed += credits;
      newIds.push(...inserted);
      await db
        .update(sourceTasks)
        .set({ status: "succeeded", credits, resultCount: finished.result_count ?? rows.length })
        .where(eq(sourceTasks.id, task.id));
    } catch (error) {
      failures++;
      if (isFatalSocqError(error)) fatal ??= error;
      await db.update(sourceTasks).set({ status: "failed", error: errorMessage(error) }).where(eq(sourceTasks.id, task.id));
    }
  });

  const status: RunStatus = failures === 0 ? "succeeded" : failures < jobs.length ? "partial" : "failed";
  const finishedAt = new Date().toISOString();
  const roundedCredits = Math.round(creditsUsed * 100) / 100;
  await db
    .update(runs)
    .set({
      status,
      finishedAt,
      creditsUsed: roundedCredits,
      newMentions: newIds.length,
      error: fatal ? errorMessage(fatal) : failures ? `${failures} of ${jobs.length} searches failed` : null,
    })
    .where(eq(runs.id, run.id));
  await db.update(projects).set({ lastRunAt: finishedAt }).where(eq(projects.id, project.id));

  if (fatal) await pauseProject(db, project.id, fatal instanceof SocqAuthError ? "auth" : "credits");

  if (newIds.length) {
    try {
      await maybeSendSpikeAlert(db, project, run.id, newIds);
    } catch (error) {
      console.error("[open-social-listening] alert delivery failed:", errorMessage(error));
    }
  }

  return {
    runId: run.id,
    status,
    creditsUsed: roundedCredits,
    newMentions: newIds.length,
    error: fatal ? errorMessage(fatal) : undefined,
  };
}
