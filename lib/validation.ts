import { z } from "zod";
import { isSourceId } from "@/lib/sources";
import type { SourcesConfig } from "@/lib/types";

const term = z.string().trim().min(1).max(100);
const termList = z.array(term).max(50);

const competitor = z.object({
  name: z.string().trim().min(1).max(80),
  terms: z.array(term).min(1).max(20),
});

const sourceSetting = z.object({
  enabled: z.boolean(),
  resultsLimit: z.number().int().min(1).max(2000).optional(),
});

/** Unknown source ids are dropped rather than rejected, so older clients keep working. */
const sourcesConfig = z
  .record(z.string(), sourceSetting)
  .transform((value): SourcesConfig => Object.fromEntries(Object.entries(value).filter(([id]) => isSourceId(id))));

const projectFields = z.object({
  name: z.string().trim().min(1).max(80),
  brandTerms: termList,
  keywords: termList,
  competitors: z.array(competitor).max(10),
  excludeTerms: termList,
  sources: sourcesConfig,
  /** 60 = hourly … 10080 = weekly. */
  intervalMinutes: z.number().int().min(60).max(10080),
  /** 0 disables the cap. */
  monthlyBudgetCredits: z.number().int().min(0).max(10_000_000),
});

const hasSomethingToTrack = (value: { brandTerms?: string[]; keywords?: string[]; competitors?: unknown[] }) =>
  (value.brandTerms?.length ?? 0) + (value.keywords?.length ?? 0) + (value.competitors?.length ?? 0) > 0;

export const projectCreateSchema = projectFields
  .extend({
    brandTerms: termList.default([]),
    keywords: termList.default([]),
    competitors: z.array(competitor).max(10).default([]),
    excludeTerms: termList.default([]),
    sources: sourcesConfig.optional(),
    intervalMinutes: projectFields.shape.intervalMinutes.default(1440),
    monthlyBudgetCredits: projectFields.shape.monthlyBudgetCredits.default(3000),
  })
  .refine(hasSomethingToTrack, { message: "Add at least one brand term, keyword or competitor", path: ["brandTerms"] });

export const projectUpdateSchema = projectFields.partial().extend({
  paused: z.boolean().optional(),
});

/** Draft used by the cost estimator; everything optional. */
export const estimateSchema = z.object({
  brandTerms: termList.default([]),
  keywords: termList.default([]),
  competitors: z.array(competitor).max(10).default([]),
  sources: sourcesConfig.optional(),
  intervalMinutes: z.number().int().min(60).max(10080).default(1440),
});

export const mentionUpdateSchema = z
  .object({ starred: z.boolean().optional(), read: z.boolean().optional() })
  .refine((value) => value.starred !== undefined || value.read !== undefined, { message: "Nothing to update" });

export const settingsUpdateSchema = z.object({
  apiKey: z.string().trim().min(8).max(200).nullable(),
});

const alertBase = z.object({
  enabled: z.boolean().optional(),
  spikeMultiplier: z.number().min(1.1).max(50).optional(),
});

export const alertCreateSchema = z.discriminatedUnion("kind", [
  alertBase.extend({ kind: z.literal("slack"), target: z.string().trim().url() }),
  alertBase.extend({ kind: z.literal("discord"), target: z.string().trim().url() }),
  alertBase.extend({ kind: z.literal("webhook"), target: z.string().trim().url() }),
  alertBase.extend({ kind: z.literal("email"), target: z.string().trim().email() }),
]);

export const alertUpdateSchema = alertBase.extend({
  target: z.string().trim().min(3).max(500).optional(),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
