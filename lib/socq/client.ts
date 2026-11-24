import {
  SocqAuthError,
  SocqError,
  SocqInsufficientCreditsError,
  SocqRateLimitError,
  SocqTaskFailedError,
  SocqTimeoutError,
} from "./errors";
import type { AccountInfo, SocqItem, SubmitResult, TaskInfo, TaskStatus } from "./types";

export const DEFAULT_SOCQ_API_BASE = "https://api.socq.ai";
export const USER_AGENT = "open-social-listening/0.1 (+https://github.com/SocQAPI/open-social-listening)";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SocqClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  /** How many times a 429 response is retried before giving up. */
  maxRateLimitRetries?: number;
}

export interface GetTaskOptions {
  limit?: number;
  cursor?: string | null;
}

export interface WaitOptions {
  timeoutMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  pageLimit?: number;
}

const TASK_STATUSES: readonly TaskStatus[] = ["queued", "running", "succeeded", "failed"];

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class SocqClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRateLimitRetries: number;

  constructor(options: SocqClientOptions) {
    if (!options.apiKey?.trim()) throw new Error("SocQ API key is required");
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? process.env.SOCQ_API_BASE ?? DEFAULT_SOCQ_API_BASE).replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? defaultSleep;
    this.maxRateLimitRetries = options.maxRateLimitRetries ?? 3;
  }

  /** Submit a collection task, e.g. `submit("reddit/search", { query: "acme" })`. */
  async submit(endpoint: string, input: Record<string, unknown>): Promise<SubmitResult> {
    const path = `/v1/${endpoint.replace(/^\/+/, "")}`;
    const data = asRecord(await this.request("POST", path, input));
    const taskId = typeof data.task_id === "string" ? data.task_id : null;
    if (!taskId) throw new SocqError("SocQ did not return a task_id", 502, data);
    return {
      task_id: taskId,
      status: parseStatus(data.status) ?? "queued",
      credits_amount: toNumber(data.credits_amount),
    };
  }

  async getTask(taskId: string, options: GetTaskOptions = {}): Promise<TaskInfo> {
    const params = new URLSearchParams();
    params.set("limit", String(options.limit ?? 500));
    if (options.cursor) params.set("cursor", options.cursor);
    const data = asRecord(await this.request("GET", `/v1/tasks/${encodeURIComponent(taskId)}?${params.toString()}`));
    return parseTask(taskId, data);
  }

  /** Poll until the task succeeds. Throws on `failed` or timeout. */
  async waitForTask(taskId: string, options: WaitOptions = {}): Promise<TaskInfo> {
    const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
    const maxDelayMs = options.maxDelayMs ?? 10_000;
    let delayMs = options.initialDelayMs ?? 2_000;
    const startedAt = Date.now();

    for (;;) {
      const task = await this.getTask(taskId, { limit: options.pageLimit ?? 500 });
      if (task.status === "succeeded") return task;
      if (task.status === "failed") {
        throw new SocqTaskFailedError(taskId, task.error_message || `Task ${taskId} failed`);
      }
      if (Date.now() - startedAt + delayMs > timeoutMs) throw new SocqTimeoutError(taskId, timeoutMs);
      await this.sleep(delayMs);
      delayMs = Math.min(Math.round(delayMs * 1.5), maxDelayMs);
    }
  }

  /** Yield every result item of a succeeded task, following `next_cursor`. */
  async *iterateResults(task: TaskInfo, pageLimit = 500): AsyncGenerator<SocqItem> {
    let page = task.results ?? null;
    if (!page) {
      page = (await this.getTask(task.task_id, { limit: pageLimit })).results ?? null;
    }
    while (page) {
      for (const item of page.items) yield item;
      if (!page.has_more || !page.next_cursor) return;
      const next = await this.getTask(task.task_id, { limit: pageLimit, cursor: page.next_cursor });
      page = next.results ?? null;
    }
  }

  async getAccount(): Promise<AccountInfo> {
    const raw = asRecord(await this.request("GET", "/v1/account"));
    return {
      credits: toNumber(raw.credits),
      email: typeof raw.email === "string" ? raw.email : null,
      raw,
    };
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await readBody(response);
      const status = effectiveStatus(response, payload);

      if (status < 400) return unwrap(payload);

      const message = describeError(payload, status);
      if (status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
        if (attempt < this.maxRateLimitRetries) {
          await this.sleep(retryAfterMs ?? 2_000 * (attempt + 1));
          continue;
        }
        throw new SocqRateLimitError(message, retryAfterMs, payload);
      }
      if (status === 401 || status === 403) throw new SocqAuthError(message, status, payload);
      if (status === 402) throw new SocqInsufficientCreditsError(message, payload);
      throw new SocqError(message, status, payload);
    }
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** SocQ wraps responses as `{ code, data }`; a non-2xx `code` in a 200 body is still an error. */
function effectiveStatus(response: Response, payload: unknown): number {
  if (!response.ok) return response.status;
  if (payload && typeof payload === "object" && "code" in payload) {
    const code = (payload as { code: unknown }).code;
    if (typeof code === "number" && code >= 400) return code;
  }
  return response.status;
}

function unwrap(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

function describeError(payload: unknown, status: number): string {
  if (typeof payload === "string" && payload.trim()) return payload.trim().slice(0, 300);
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["message", "detail", "error", "msg"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return `SocQ request failed with status ${status}`;
}

export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

function parseTask(taskId: string, data: Record<string, unknown>): TaskInfo {
  const results = data.results && typeof data.results === "object" ? (data.results as Record<string, unknown>) : null;
  return {
    task_id: typeof data.task_id === "string" ? data.task_id : taskId,
    status: parseStatus(data.status) ?? "queued",
    result_count: toNumber(data.result_count),
    credits_amount: toNumber(data.credits_amount),
    error_message: typeof data.error_message === "string" ? data.error_message : null,
    results: results
      ? {
          items: Array.isArray(results.items) ? (results.items as SocqItem[]) : [],
          next_cursor: typeof results.next_cursor === "string" ? results.next_cursor : null,
          has_more: results.has_more === true,
        }
      : null,
  };
}

function parseStatus(value: unknown): TaskStatus | null {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value) ? (value as TaskStatus) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
