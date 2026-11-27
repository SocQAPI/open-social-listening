import type { ZodError } from "zod";

// Plain Response (not NextResponse) so the handlers also run in the browser for the static demo.
export function json<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

/** Error bodies are always `{ error: <machine code>, message?, issues? }`. */
export function fail(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status });
}

export function invalid(zodError: ZodError): Response {
  return fail(400, "invalid_request", {
    issues: zodError.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}

export function parseId(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Route context for `[id]` segments (Next.js passes params as a promise). */
export interface IdContext {
  params: Promise<{ id: string }>;
}
