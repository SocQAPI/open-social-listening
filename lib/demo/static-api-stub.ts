// Stands in for lib/demo/static-api in the normal server build (aliased in next.config.ts), so the browser
// bundle never pulls in the route handlers and their server-only dependencies. It is never called there.
export function demoFetch(): never {
  throw new Error("The static demo API is only available in the static demo build.");
}

export function demoDownload(): never {
  throw new Error("The static demo API is only available in the static demo build.");
}
