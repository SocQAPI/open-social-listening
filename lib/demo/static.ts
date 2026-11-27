/**
 * The static demo (GitHub Pages) is a `next build` with OSL_STATIC_DEMO=1: no server, the API runs in the
 * browser on an in-memory SQLite database (sql.js) seeded with the demo project. See scripts/build-demo.mjs.
 */
export const STATIC_DEMO = process.env.NEXT_PUBLIC_OSL_STATIC_DEMO === "1";

/** basePath of the static demo, e.g. "/open-social-listening"; empty for a normal install. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const REPO_URL = "https://github.com/SocQAPI/open-social-listening";

/** Project ids to prerender for /p/[projectId]: the seeded demo project in the static demo, none otherwise. */
export function demoStaticParams(): { projectId: string }[] {
  return STATIC_DEMO ? [{ projectId: "1" }] : [];
}

/** The step-by-step guides in docs/, in the interface language (English is the file without a suffix). */
export function guideUrl(doc: "deploy" | "getting-started", locale: string): string {
  return `${REPO_URL}/blob/main/docs/${doc}${locale === "en" ? "" : `.${locale}`}.md`;
}
