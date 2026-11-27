import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { createDemoDb } from "@/lib/demo/static-bootstrap";

// The static demo runs the real route handlers on sql.js. This test does the same on Node's sql.js, so a
// change that breaks the GitHub Pages demo fails here first.

let demoDb: Promise<Db>;
vi.mock("@/lib/bootstrap", () => ({ ensureReady: () => demoDb }));

const { demoFetch } = await import("@/lib/demo/static-api");

async function getJson<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await demoFetch(path, init);
  return { status: response.status, body: (await response.json()) as T };
}

beforeAll(() => {
  demoDb = initSqlJs().then(createDemoDb);
});

describe("static demo API", () => {
  it("lists the seeded demo project", async () => {
    const { status, body } = await getJson<{ items: { id: number; isDemo: boolean; name: string }[] }>("/api/projects");
    expect(status).toBe(200);
    expect(body.items).toEqual([expect.objectContaining({ id: 1, isDemo: true, name: "Acme Notes (demo)" })]);
  });

  it("serves mentions with filters and pagination, dated relative to now", async () => {
    const all = await getJson<{ items: { id: number; source: string; sortAt: string }[]; nextCursor: string | null }>("/api/mentions?projectId=1&limit=50");
    expect(all.status).toBe(200);
    expect(all.body.items.length).toBeGreaterThan(20);
    const newest = Date.parse(all.body.items[0].sortAt);
    expect(Date.now() - newest).toBeLessThan(24 * 60 * 60 * 1000);

    const reddit = await getJson<{ items: { source: string }[] }>("/api/mentions?projectId=1&source=reddit&limit=50");
    expect(reddit.body.items.length).toBeGreaterThan(0);
    expect(reddit.body.items.every((m) => m.source === "reddit")).toBe(true);

    const page = await getJson<{ items: unknown[]; nextCursor: string | null }>("/api/mentions?projectId=1&limit=5");
    expect(page.body.items).toHaveLength(5);
    expect(page.body.nextCursor).toBeTruthy();
  });

  it("computes dashboard stats", async () => {
    const { status, body } = await getJson<{ totals: { mentions: number }; daily: unknown[]; shareOfVoice: unknown[] }>("/api/stats?projectId=1&days=14");
    expect(status).toBe(200);
    expect(body.daily).toHaveLength(14);
    expect(body.totals.mentions).toBeGreaterThan(0);
    expect(body.shareOfVoice.length).toBeGreaterThan(1);
  });

  it("keeps stars for the session", async () => {
    const patched = await demoFetch("/api/mentions/3", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ starred: true }) });
    expect(patched.status).toBe(200);
    const starred = await getJson<{ items: { id: number }[] }>("/api/mentions?projectId=1&starred=1&limit=50");
    expect(starred.body.items.map((m) => m.id)).toContain(3);
  });

  it("exports CSV", async () => {
    const response = await demoFetch("/api/export?projectId=1&format=csv");
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv.split("\n")[0]).toContain("url");
    expect(csv.split("\n").length).toBeGreaterThan(20);
  });

  it("answers static_demo to anything that would save, run or send", async () => {
    for (const [path, method] of [
      ["/api/settings", "PUT"],
      ["/api/projects", "POST"],
      ["/api/projects/1/run", "POST"],
      ["/api/projects/1", "DELETE"],
      ["/api/alerts/1/test", "POST"],
      ["/api/account", "GET"],
    ]) {
      const { status, body } = await getJson<{ error: string }>(path, { method, body: method === "GET" ? undefined : "{}" });
      expect([path, status, body.error]).toEqual([path, 403, "static_demo"]);
    }
  });
});
