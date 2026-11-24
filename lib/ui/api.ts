"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Human copy for the machine codes the API returns. */
const MESSAGES: Record<string, string> = {
  no_api_key: "Connect your SocQ API key first.",
  invalid_api_key: "SocQ did not accept that API key.",
  api_key_managed_by_env: "The API key is set by SOCQ_API_KEY on the server. Change it there.",
  socq_unreachable: "Could not reach SocQ. Check the server's network and try again.",
  demo_project: "The demo project can't fetch live data. Create your own project to start listening.",
  already_running: "A run is already in progress.",
  project_not_found: "That project no longer exists.",
  delivery_failed: "The test alert could not be delivered.",
  invalid_request: "Some fields need another look.",
};

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? error.message ?? "Something went wrong.";
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `http_${res.status}`, body?.message);
  }
  return body as T;
}

export interface UseApiResult<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (updater: (prev: T | null) => T | null) => void;
}

/** Minimal fetch-on-mount hook. Pass null to skip. Keeps the previous data while reloading. */
export function useApi<T>(url: string | null, options?: { refreshMs?: number }): UseApiResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(url));
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const ticket = ++latest.current;
    setLoading(true);
    try {
      const next = await api<T>(url);
      if (ticket === latest.current) {
        setDataState(next);
        setError(null);
      }
    } catch (err) {
      if (ticket === latest.current) setError(err);
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!url || !options?.refreshMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, options.refreshMs);
    return () => window.clearInterval(timer);
  }, [url, options?.refreshMs, load]);

  const setData = useCallback((updater: (prev: T | null) => T | null) => setDataState(updater), []);

  return { data, error, loading, reload: load, setData };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
