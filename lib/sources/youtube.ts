import { mapSocialPost, pickWindow } from "./map";
import type { SourceDefinition } from "./types";

const WINDOWS = ["hour", "day", "week", "month", "year"] as const;

export const youtube: SourceDefinition = {
  id: "youtube",
  label: "YouTube",
  platform: "youtube",
  endpoint: "youtube/search",
  pricing: { base: 0, perResult: 0.5 },
  limits: { min: 1, max: 2000, default: 20 },
  supportsResultsLimit: true,
  defaultEnabled: true,
  buildInput: (term, { resultsLimit, window }) => ({
    query: term,
    sort_by: "date",
    published_within: pickWindow(window, WINDOWS),
    results_limit: resultsLimit,
  }),
  map: mapSocialPost("youtube"),
};
