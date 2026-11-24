import { mapSocialPost } from "./map";
import type { SourceDefinition } from "./types";

/** Threads search only takes a query; cost estimates assume `limits.default` results. */
export const threads: SourceDefinition = {
  id: "threads",
  label: "Threads",
  platform: "threads",
  endpoint: "threads/search",
  pricing: { base: 0, perResult: 0.6 },
  limits: { min: 1, max: 2000, default: 20 },
  supportsResultsLimit: false,
  defaultEnabled: false,
  buildInput: (term) => ({ query: term }),
  map: mapSocialPost("threads"),
};
