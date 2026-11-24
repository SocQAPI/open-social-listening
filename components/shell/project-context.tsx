"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProjectDTO } from "@/lib/dto";
import { api, errorText, useApi } from "@/lib/ui/api";
import { useToast } from "@/components/ui/toast";

export type ProjectWithCounts = ProjectDTO & { counts?: { mentions: number; unread: number } };

export interface SettingsSnapshot {
  apiKey: { configured: boolean; source: "env" | "db" | null; preview: string | null };
  scheduler: { enabled: boolean };
  passwordProtected: boolean;
  email: { configured: boolean };
}

interface Account {
  credits: number | null;
  creditsUsd: number | null;
  topUpUrl: string;
}

interface UsageStats {
  credits: { thisMonth: number; budget: number; estimatedMonthly: number };
}

interface ProjectContextValue {
  projectId: number;
  project: ProjectWithCounts | null;
  projects: ProjectWithCounts[] | null;
  settings: SettingsSnapshot | null;
  account: Account | null;
  monthUsed: number | null;
  running: boolean;
  /** Bumped after every finished run so views can refetch. */
  runVersion: number;
  reloadProjects: () => Promise<void>;
  reloadSettings: () => Promise<void>;
  runNow: () => Promise<void>;
}

const Ctx = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useProject must be used inside <ProjectProvider>");
  return value;
}

export function ProjectProvider({ projectId, children }: { projectId: number; children: ReactNode }) {
  const toast = useToast();
  const projectsQ = useApi<{ items: ProjectWithCounts[] }>("/api/projects", { refreshMs: 60_000 });
  const settingsQ = useApi<SettingsSnapshot>("/api/settings");
  const keyReady = Boolean(settingsQ.data?.apiKey.configured);
  const accountQ = useApi<Account>(keyReady ? "/api/account" : null, { refreshMs: 120_000 });
  const usageQ = useApi<UsageStats>(`/api/stats?projectId=${projectId}&days=1`, { refreshMs: 120_000 });
  const [running, setRunning] = useState(false);
  const [runVersion, setRunVersion] = useState(0);
  const pollRef = useRef<number | null>(null);

  const projects = projectsQ.data?.items ?? null;
  const project = projects?.find((p) => p.id === projectId) ?? null;

  useEffect(() => {
    if (project?.running) setRunning(true);
  }, [project?.running]);

  const stopPolling = () => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = null;
  };

  // While a run is in flight, poll the project until the runner reports it finished.
  useEffect(() => {
    if (!running) return;
    const before = project?.counts?.mentions ?? 0;
    let lastSeen = before;
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const { items } = await api<{ items: ProjectWithCounts[] }>("/api/projects");
        const current = items.find((p) => p.id === projectId);
        // Sources finish at different speeds and each one is stored as soon as it is done,
        // so refresh the views whenever new mentions land instead of waiting for the slowest source.
        if (current?.running && (current.counts?.mentions ?? 0) !== lastSeen) {
          lastSeen = current.counts?.mentions ?? 0;
          projectsQ.setData(() => ({ items }));
          setRunVersion((v) => v + 1);
        }
        if (current && !current.running) {
          stopPolling();
          setRunning(false);
          projectsQ.setData(() => ({ items }));
          setRunVersion((v) => v + 1);
          void usageQ.reload();
          void accountQ.reload();
          const added = Math.max(0, (current.counts?.mentions ?? 0) - before);
          if (current.paused && current.pausedReason) {
            toast(pausedText(current.pausedReason), "error");
          } else {
            toast(added ? `Run finished · ${added} new mention${added === 1 ? "" : "s"}` : "Run finished · nothing new this time", "ok");
          }
        }
      } catch {
        /* keep polling; transient errors are fine */
      }
    }, 3000);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, projectId]);

  const runNow = useCallback(async () => {
    try {
      await api(`/api/projects/${projectId}/run`, { method: "POST" });
      setRunning(true);
      toast("Run started. New mentions will appear here as soon as it finishes.", "info");
    } catch (error) {
      toast(errorText(error), "error");
    }
  }, [projectId, toast]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projectId,
      project,
      projects,
      settings: settingsQ.data,
      account: accountQ.data,
      monthUsed: usageQ.data?.credits.thisMonth ?? null,
      running,
      runVersion,
      reloadProjects: projectsQ.reload,
      reloadSettings: settingsQ.reload,
      runNow,
    }),
    [projectId, project, projects, settingsQ.data, accountQ.data, usageQ.data, running, runVersion, projectsQ.reload, settingsQ.reload, runNow],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function pausedText(reason: string): string {
  switch (reason) {
    case "budget":
      return "Paused: this month's credit budget is used up. Raise the budget in Settings to resume.";
    case "credits":
      return "Paused: your SocQ balance ran out. Top up on socq.ai, then resume in Settings.";
    case "auth":
      return "Paused: SocQ rejected the API key. Replace it in Settings.";
    default:
      return "Paused. Resume it in Settings.";
  }
}
