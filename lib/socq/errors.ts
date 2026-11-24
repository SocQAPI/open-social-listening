export class SocqError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "SocqError";
    this.status = status;
    this.body = body;
  }
}

/** 401/403: the API key is missing, wrong or revoked. */
export class SocqAuthError extends SocqError {
  constructor(message: string, status: number, body?: unknown) {
    super(message, status, body);
    this.name = "SocqAuthError";
  }
}

/** 402: the SocQ account does not have enough credits. */
export class SocqInsufficientCreditsError extends SocqError {
  constructor(message: string, body?: unknown) {
    super(message, 402, body);
    this.name = "SocqInsufficientCreditsError";
  }
}

/** 429: request-rate or API-key credit limit; retries were exhausted. */
export class SocqRateLimitError extends SocqError {
  readonly retryAfterMs: number | null;

  constructor(message: string, retryAfterMs: number | null, body?: unknown) {
    super(message, 429, body);
    this.name = "SocqRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** The task reached the `failed` state. */
export class SocqTaskFailedError extends SocqError {
  readonly taskId: string;

  constructor(taskId: string, message: string) {
    super(message, 200);
    this.name = "SocqTaskFailedError";
    this.taskId = taskId;
  }
}

/** The task did not finish within the polling timeout. */
export class SocqTimeoutError extends SocqError {
  readonly taskId: string;

  constructor(taskId: string, timeoutMs: number) {
    super(`Task ${taskId} did not finish within ${Math.round(timeoutMs / 1000)}s`, 0);
    this.name = "SocqTimeoutError";
    this.taskId = taskId;
  }
}

export function isFatalSocqError(error: unknown): error is SocqAuthError | SocqInsufficientCreditsError {
  return error instanceof SocqAuthError || error instanceof SocqInsufficientCreditsError;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
