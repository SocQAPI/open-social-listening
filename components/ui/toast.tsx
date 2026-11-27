"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useI18n } from "@/lib/i18n";

type Tone = "ok" | "info" | "error";

interface Toast {
  id: number;
  tone: Tone;
  text: string;
  leaving: boolean;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Matches --animate-toast-out, so the toast is removed once it has slid away. */
const EXIT_MS = 180;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const push = useCallback((text: string, tone: Tone = "ok") => {
    const id = ++seq.current;
    setToasts((all) => [...all.slice(-3), { id, tone, text, leaving: false }]);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * One toast. A thin bar along the bottom shows the time left; pointing at the toast pauses it, so a long
 * error can be read in full.
 */
function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { m } = useI18n();
  const life = t.tone === "error" ? 7000 : 4000;
  const [paused, setPaused] = useState(false);
  const left = useRef(life);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused || t.leaving) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(t.id), left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = Math.max(0, left.current - (Date.now() - startedAt.current));
    };
  }, [paused, t.leaving, t.id, onDismiss]);

  const Icon = t.tone === "ok" ? CheckCircle2 : t.tone === "error" ? TriangleAlert : Info;
  return (
    <div
      role={t.tone === "error" ? "alert" : "status"}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className={cn(
        "pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-[0_12px_32px_rgba(23,24,28,0.22)]",
        t.leaving ? "animate-toast-out" : "animate-rise",
      )}
    >
      <Icon aria-hidden="true" className={cn("animate-pop-in mt-0.5 size-4 shrink-0 [animation-delay:80ms]", t.tone === "error" ? "text-accent" : t.tone === "ok" ? "text-[#7fd1a8]" : "text-white/80")} />
      <span className="flex-1">{t.text}</span>
      <button
        type="button"
        onClick={() => onDismiss(t.id)}
        aria-label={m.common.dismiss}
        className="-m-1 cursor-pointer rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-white/25"
        style={{ animation: `countdown ${life}ms linear both`, animationPlayState: paused || t.leaving ? "paused" : "running" }}
      />
    </div>
  );
}
