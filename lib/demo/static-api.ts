/**
 * The API of the static demo, in the browser: requests are matched to the real route handlers, which run
 * against the sql.js database from static-bootstrap. Reading, starring and marking read work (in memory,
 * for this page load); anything that would save settings, call SocQ or send alerts answers `static_demo`.
 */

type RouteModule = Record<string, unknown>;
type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;

interface Route {
  method: string;
  pattern: RegExp;
  load: () => Promise<RouteModule>;
}

const ROUTES: Route[] = [
  { method: "GET", pattern: /^\/api\/projects$/, load: () => import("@/app/api/projects/route") },
  { method: "GET", pattern: /^\/api\/projects\/(?<id>\d+)$/, load: () => import("@/app/api/projects/[id]/route") },
  { method: "GET", pattern: /^\/api\/projects\/(?<id>\d+)\/alerts$/, load: () => import("@/app/api/projects/[id]/alerts/route") },
  { method: "GET", pattern: /^\/api\/settings$/, load: () => import("@/app/api/settings/route") },
  { method: "GET", pattern: /^\/api\/stats$/, load: () => import("@/app/api/stats/route") },
  { method: "GET", pattern: /^\/api\/mentions$/, load: () => import("@/app/api/mentions/route") },
  { method: "PATCH", pattern: /^\/api\/mentions\/(?<id>\d+)$/, load: () => import("@/app/api/mentions/[id]/route") },
  { method: "POST", pattern: /^\/api\/mentions\/mark-read$/, load: () => import("@/app/api/mentions/mark-read/route") },
  { method: "GET", pattern: /^\/api\/export$/, load: () => import("@/app/api/export/route") },
  { method: "POST", pattern: /^\/api\/estimate$/, load: () => import("@/app/api/estimate/route") },
];

function readOnly(): Response {
  return Response.json(
    {
      error: "static_demo",
      message: "This is a read-only demo. Install Open Social Listening on your own server to connect SocQ and track your brand.",
    },
    { status: 403 },
  );
}

/** fetch() for /api/* paths in the static demo. */
export async function demoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, "https://demo.local");
  const method = (init.method ?? "GET").toUpperCase();
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(url.pathname);
    if (!match) continue;
    const handler = (await route.load())[method] as Handler | undefined;
    if (!handler) break;
    const request = new Request(url, { method, headers: init.headers, body: method === "GET" ? undefined : init.body });
    return handler(request, { params: Promise.resolve({ ...match.groups }) });
  }
  return readOnly();
}

/** Download a CSV or JSON export, which a plain link can't fetch without a server. */
export async function demoDownload(path: string, filename: string): Promise<void> {
  const response = await demoFetch(path);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
