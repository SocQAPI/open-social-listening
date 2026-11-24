import { mapSocialPost, pickWindow } from "./map";
import type { SourceDefinition } from "./types";

const WINDOWS = ["hour", "day", "week", "month", "year"] as const;

export const instagram: SourceDefinition = {
  id: "instagram",
  label: "Instagram",
  platform: "instagram",
  endpoint: "instagram/reels-search",
  pricing: { base: 0, perResult: 0.5 },
  limits: { min: 20, max: 2000, default: 20 },
  supportsResultsLimit: true,
  defaultEnabled: false,
  buildInput: (term, { resultsLimit, window }) => ({
    query: term,
    published_within: pickWindow(window, WINDOWS),
    results_limit: resultsLimit,
  }),
  map: mapSocialPost("instagram"),
};
