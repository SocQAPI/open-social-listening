import { mapSocialPost } from "./map";
import type { SourceDefinition } from "./types";

/** LinkedIn post search: results_limit must be at least 10 and a multiple of 10. */
export const linkedin: SourceDefinition = {
  id: "linkedin",
  label: "LinkedIn",
  platform: "linkedin",
  endpoint: "linkedin/search-posts",
  pricing: { base: 0, perResult: 0.5 },
  limits: { min: 10, max: 2000, step: 10, default: 20 },
  supportsResultsLimit: true,
  defaultEnabled: false,
  buildInput: (term, { resultsLimit }) => ({
    query: term,
    results_limit: resultsLimit,
  }),
  map: mapSocialPost("linkedin"),
};
