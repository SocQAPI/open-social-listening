import { and, count, desc, eq } from "drizzle-orm";
import { mentions, projects } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { toProjectDTO } from "@/lib/dto";
import { fail, invalid, json, readJson } from "@/lib/http";
import { defaultSourcesConfig } from "@/lib/sources";
import { projectCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/projects → { items: ProjectDTO[] } (each with counts.mentions / counts.unread). */
export async function GET() {
  const db = await ensureReady();
  const rows = await db.select().from(projects).orderBy(desc(projects.isDemo), projects.createdAt);
  const items = await Promise.all(
    rows.map(async (row) => {
      const [total, unread] = await Promise.all([
        db.select({ n: count() }).from(mentions).where(eq(mentions.projectId, row.id)).get(),
        db
          .select({ n: count() })
          .from(mentions)
          .where(and(eq(mentions.projectId, row.id), eq(mentions.read, false)))
          .get(),
      ]);
      return toProjectDTO(row, { mentions: total?.n ?? 0, unread: unread?.n ?? 0 });
    }),
  );
  return json({ items });
}

/** POST /api/projects → 201 ProjectDTO */
export async function POST(request: Request) {
  const parsed = projectCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const db = await ensureReady();
  const [row] = await db
    .insert(projects)
    .values({
      name: input.name,
      brandTerms: input.brandTerms,
      keywords: input.keywords,
      competitors: input.competitors,
      excludeTerms: input.excludeTerms,
      sources: { ...defaultSourcesConfig(), ...(input.sources ?? {}) },
      intervalMinutes: input.intervalMinutes,
      monthlyBudgetCredits: input.monthlyBudgetCredits,
      paused: false,
      pausedReason: null,
      isDemo: false,
      lastRunAt: null,
      createdAt: new Date().toISOString(),
    })
    .returning();
  if (!row) return fail(500, "insert_failed");
  return json(toProjectDTO(row, { mentions: 0, unread: 0 }), 201);
}
