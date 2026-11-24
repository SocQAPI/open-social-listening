import { desc, eq } from "drizzle-orm";
import { mentions, projects } from "@/db/schema";
import { ensureReady } from "@/lib/bootstrap";
import { toMentionDTO, type MentionDTO } from "@/lib/dto";
import { fail, parseId } from "@/lib/http";
import { filtersFromSearchParams, mentionConditions } from "@/lib/mention-query";

export const dynamic = "force-dynamic";

const CSV_COLUMNS: [string, (mention: MentionDTO) => unknown][] = [
  ["published_at", (m) => m.publishedAt ?? m.sortAt],
  ["source", (m) => m.source],
  ["term_kind", (m) => m.termKind],
  ["matched_term", (m) => m.matchedTerm],
  ["competitor", (m) => m.competitorName],
  ["author", (m) => m.author.name],
  ["handle", (m) => m.author.handle],
  ["title", (m) => m.title],
  ["text", (m) => m.text],
  ["url", (m) => m.url],
  ["likes", (m) => m.metrics.likes],
  ["comments", (m) => m.metrics.comments],
  ["shares", (m) => m.metrics.shares],
  ["views", (m) => m.metrics.views],
  ["sentiment", (m) => m.sentiment],
  ["starred", (m) => m.starred],
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Keep spreadsheet apps from evaluating cells as formulas.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

/**
 * GET /api/export?projectId=1&format=csv|json[&…same filters as /api/mentions]
 * → a file download (UTF-8 CSV with BOM, or a JSON array of MentionDTO).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectId = parseId(params.get("projectId"));
  if (!projectId) return fail(400, "project_id_required");
  const format = params.get("format") === "json" ? "json" : "csv";

  const db = await ensureReady();
  const project = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return fail(404, "project_not_found");
  const rows = await db
    .select()
    .from(mentions)
    .where(mentionConditions(filtersFromSearchParams(params, projectId)))
    .orderBy(desc(mentions.sortAt), desc(mentions.id));
  const items = rows.map(toMentionDTO);
  const filename = `${slug(project.name)}-mentions-${new Date().toISOString().slice(0, 10)}.${format}`;

  const body =
    format === "json"
      ? JSON.stringify(items, null, 2)
      : "﻿" +
        [
          CSV_COLUMNS.map(([name]) => name).join(","),
          ...items.map((item) => CSV_COLUMNS.map(([, read]) => csvCell(read(item))).join(",")),
        ].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
