import { mapBrandMention } from "./map";
import type { SourceDefinition } from "./types";

/** Blogs, forums and other web pages, with sentiment scores. Billed 10 credits per request plus results. */
export const web: SourceDefinition = {
  id: "web",
  label: "Web & forums",
  platform: "web",
  endpoint: "brand-monitoring/mentions",
  pricing: { base: 10, perResult: 0.02 },
  limits: { min: 1, max: 1000, default: 20 },
  supportsResultsLimit: true,
  defaultEnabled: true,
  buildInput: (term, { resultsLimit }) => ({
    query: term,
    results_limit: resultsLimit,
  }),
  map: mapBrandMention,
};
