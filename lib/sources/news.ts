import { mapNewsArticle } from "./map";
import type { SourceDefinition } from "./types";

export const news: SourceDefinition = {
  id: "news",
  label: "News",
  platform: "news",
  endpoint: "seo/google-news",
  pricing: { base: 0, perResult: 0.1 },
  limits: { min: 1, max: 200, default: 20 },
  supportsResultsLimit: true,
  defaultEnabled: true,
  buildInput: (term, { resultsLimit }) => ({
    query: term,
    language_code: "en",
    results_limit: resultsLimit,
  }),
  map: mapNewsArticle,
};
