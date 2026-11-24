import { mapSocialPost } from "./map";
import type { SourceDefinition } from "./types";

/** X search has no time filter; `latest` ordering plus URL de-duplication keeps runs incremental. */
export const x: SourceDefinition = {
  id: "x",
  label: "X",
  platform: "x",
  endpoint: "x/search",
  pricing: { base: 0, perResult: 0.7 },
  limits: { min: 1, max: 2000, default: 20 },
  supportsResultsLimit: true,
  defaultEnabled: true,
  buildInput: (term, { resultsLimit }) => ({
    query: term,
    sort_by: "latest",
    results_limit: resultsLimit,
  }),
  map: mapSocialPost("x"),
};
