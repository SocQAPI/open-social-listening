import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type {
  AlertKind,
  Competitor,
  MentionMetrics,
  PausedReason,
  RunStatus,
  Sentiment,
  SourcesConfig,
  SourceTaskStatus,
  TermKind,
} from "@/lib/types";

// Keep in sync with db/migrations.ts — the SQL there is what actually creates the tables.

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  brandTerms: text("brand_terms", { mode: "json" }).$type<string[]>().notNull(),
  keywords: text("keywords", { mode: "json" }).$type<string[]>().notNull(),
  competitors: text("competitors", { mode: "json" }).$type<Competitor[]>().notNull(),
  excludeTerms: text("exclude_terms", { mode: "json" }).$type<string[]>().notNull(),
  sources: text("sources", { mode: "json" }).$type<SourcesConfig>().notNull(),
  intervalMinutes: integer("interval_minutes").notNull().default(1440),
  monthlyBudgetCredits: integer("monthly_budget_credits").notNull().default(3000),
  paused: integer("paused", { mode: "boolean" }).notNull().default(false),
  pausedReason: text("paused_reason").$type<PausedReason>(),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  lastRunAt: text("last_run_at"),
  createdAt: text("created_at").notNull(),
});

export const runs = sqliteTable(
  "runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    status: text("status").$type<RunStatus>().notNull(),
    creditsUsed: real("credits_used").notNull().default(0),
    newMentions: integer("new_mentions").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("runs_project_started").on(t.projectId, t.startedAt)],
);

export const sourceTasks = sqliteTable(
  "source_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id").notNull(),
    source: text("source").notNull(),
    term: text("term").notNull(),
    taskId: text("task_id"),
    status: text("status").$type<SourceTaskStatus>().notNull(),
    credits: real("credits").notNull().default(0),
    resultCount: integer("result_count").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("source_tasks_run").on(t.runId)],
);

export const mentions = sqliteTable(
  "mentions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull(),
    source: text("source").notNull(),
    platform: text("platform").notNull(),
    externalId: text("external_id"),
    url: text("url").notNull(),
    title: text("title"),
    text: text("text"),
    authorName: text("author_name"),
    authorHandle: text("author_handle"),
    authorUrl: text("author_url"),
    authorAvatar: text("author_avatar"),
    publishedAt: text("published_at"),
    collectedAt: text("collected_at"),
    /** published_at, else collected_at, else insert time: the inbox and charts sort and bucket by it. */
    sortAt: text("sort_at").notNull(),
    metrics: text("metrics", { mode: "json" }).$type<MentionMetrics>().notNull(),
    matchedTerm: text("matched_term").notNull(),
    termKind: text("term_kind").$type<TermKind>().notNull(),
    competitorName: text("competitor_name"),
    sentiment: text("sentiment").$type<Sentiment>(),
    starred: integer("starred", { mode: "boolean" }).notNull().default(false),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("mentions_project_url").on(t.projectId, t.url),
    index("mentions_project_sort").on(t.projectId, t.sortAt, t.id),
  ],
);

export const alertChannels = sqliteTable(
  "alert_channels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull(),
    kind: text("kind").$type<AlertKind>().notNull(),
    target: text("target").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    spikeMultiplier: real("spike_multiplier").notNull().default(3),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("alert_channels_project").on(t.projectId)],
);

export type ProjectRow = typeof projects.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type MentionRow = typeof mentions.$inferSelect;
export type NewMentionRow = typeof mentions.$inferInsert;
export type AlertChannelRow = typeof alertChannels.$inferSelect;
