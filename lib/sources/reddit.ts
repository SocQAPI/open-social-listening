import { mapSocialPost, pickWindow } from "./map";
import type { SourceDefinition } from "./types";

const WINDOWS = ["hour", "day", "week", "month", "year", "all"] as const;

export const reddit: SourceDefinition = {
  id: "reddit",
  label: "Reddit",
  platform: "reddit",
  endpoint: "reddit/search",
  pricing: { base: 0, perResult: 0.2 },
  limits: { min: 1, max: 2000, default: 20 },
  supportsResultsLimit: true,
  defaultEnabled: true,
  buildInput: (term, { resultsLimit, window }) => ({
    query: term,
    published_within: pickWindow(window, WINDOWS),
    results_limit: resultsLimit,
  }),
  map: mapSocialPost("reddit"),
};
