import { describe, expect, it, vi } from "vitest";
import { SocqClient, type FetchLike } from "@/lib/socq/client";
import { SocqAuthError, SocqInsufficientCreditsError, SocqRateLimitError, SocqTaskFailedError } from "@/lib/socq/errors";

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

function mockFetch(replies: Reply[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const reply = replies.shift();
    if (!reply) throw new Error(`unexpected request to ${url}`);
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json", ...(reply.headers ?? {}) },
    });
  };
  return { fetch, calls };
}

function client(replies: Reply[]) {
  const mock = mockFetch(replies);
  const sleep = vi.fn(async () => {});
  return { socq: new SocqClient({ apiKey: "test-key", baseUrl: "https://api.test", fetch: mock.fetch, sleep }), sleep, calls: mock.calls };
}

describe("SocqClient", () => {
  it("submits with a bearer token and returns the task id", async () => {
    const { socq, calls } = client([{ body: { code: 200, data: { task_id: "T1", status: "queued" } } }]);
    const result = await socq.submit("reddit/search", { query: "acme" });
    expect(result).toEqual({ task_id: "T1", status: "queued", credits_amount: null });
    expect(calls[0].url).toBe("https://api.test/v1/reddit/search");
    expect(calls[0].init?.method).toBe("POST");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ query: "acme" });
  });

  it("polls until the task succeeds", async () => {
    const { socq, sleep } = client([
      { body: { code: 200, data: { task_id: "T1", status: "queued" } } },
      { body: { code: 200, data: { task_id: "T1", status: "running" } } },
      {
        body: {
          code: 200,
          data: {
            task_id: "T1",
            status: "succeeded",
            result_count: 1,
            credits_amount: 0.6,
            results: { items: [{ url: "https://x" }], next_cursor: null, has_more: false },
          },
        },
      },
    ]);
    const task = await socq.waitForTask("T1", { initialDelayMs: 2000 });
    expect(task.status).toBe("succeeded");
    expect(task.credits_amount).toBe(0.6);
    expect(task.results?.items).toHaveLength(1);
    expect(sleep).toHaveBeenNthCalledWith(1, 2000);
    expect(sleep).toHaveBeenNthCalledWith(2, 3000);
  });

  it("throws when the task fails", async () => {
    const { socq } = client([{ body: { code: 200, data: { task_id: "T1", status: "failed", error_message: "upstream timeout" } } }]);
    await expect(socq.waitForTask("T1")).rejects.toBeInstanceOf(SocqTaskFailedError);
  });

  it("follows next_cursor across result pages", async () => {
    const { socq, calls } = client([
      {
        body: {
          code: 200,
          data: { task_id: "T1", status: "succeeded", results: { items: [{ url: "https://b" }], next_cursor: null, has_more: false } },
        },
      },
    ]);
    const items = [];
    for await (const item of socq.iterateResults({
      task_id: "T1",
      status: "succeeded",
      results: { items: [{ url: "https://a" }], next_cursor: "CUR", has_more: true },
    })) {
      items.push(item.url);
    }
    expect(items).toEqual(["https://a", "https://b"]);
    expect(calls[0].url).toBe("https://api.test/v1/tasks/T1?limit=500&cursor=CUR");
  });

  it("maps 402 to SocqInsufficientCreditsError", async () => {
    const { socq } = client([{ status: 402, body: { code: 402, message: "Insufficient credits" } }]);
    await expect(socq.submit("x/search", { query: "acme" })).rejects.toBeInstanceOf(SocqInsufficientCreditsError);
  });

  it("maps 401 to SocqAuthError", async () => {
    const { socq } = client([{ status: 401, body: { detail: "Invalid API key" } }]);
    await expect(socq.getAccount()).rejects.toBeInstanceOf(SocqAuthError);
  });

  it("treats an error code inside a 200 body as an error", async () => {
    const { socq } = client([{ status: 200, body: { code: 402, message: "Insufficient credits" } }]);
    await expect(socq.submit("x/search", { query: "acme" })).rejects.toBeInstanceOf(SocqInsufficientCreditsError);
  });

  it("retries 429 after Retry-After, then succeeds", async () => {
    const { socq, sleep } = client([
      { status: 429, body: { code: 429, message: "Too many requests" }, headers: { "Retry-After": "1" } },
      { body: { code: 200, data: { task_id: "T2", status: "queued" } } },
    ]);
    await expect(socq.submit("x/search", { query: "acme" })).resolves.toMatchObject({ task_id: "T2" });
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("gives up on 429 after the retry budget", async () => {
    const mock = mockFetch([
      { status: 429, body: { code: 429 } },
      { status: 429, body: { code: 429 } },
    ]);
    const socq = new SocqClient({ apiKey: "k", baseUrl: "https://api.test", fetch: mock.fetch, sleep: async () => {}, maxRateLimitRetries: 1 });
    await expect(socq.submit("x/search", { query: "acme" })).rejects.toBeInstanceOf(SocqRateLimitError);
  });

  it("reads the account balance", async () => {
    const { socq } = client([{ body: { code: 200, data: { credits: 5781.33, email: "owner@example.com" } } }]);
    await expect(socq.getAccount()).resolves.toMatchObject({ credits: 5781.33, email: "owner@example.com" });
  });
});
