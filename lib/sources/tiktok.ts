import { mapSocialPost, pickWindow } from "./map";
import type { SourceDefinition } from "./types";

/** TikTok search has no `hour` window; hourly schedules search the last day. */
const WINDOWS = ["day", "week", "month", "three_months", "six_months"] as const;

export const tiktok: SourceDefinition = {
  id: "tiktok",
  label: "TikTok",
  platform: "tiktok",
  endpoint: "tiktok/search",
  pricing: { base: 0, perResult: 0.7 },
  limits: { min: 1, max: 2000, default: 20 },
  supportsResultsLimit: true,
  defaultEnabled: true,
  buildInput: (term, { resultsLimit, window }) => ({
    query: term,
    sort_by: "date",
    published_within: pickWindow(window, WINDOWS),
    results_limit: resultsLimit,
  }),
  map: mapSocialPost("tiktok"),
};
