"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useI18n } from "@/lib/i18n";

type Tone = "ok" | "info" | "error";

interface Toast {
  id: number;
  tone: Tone;
  text: string;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { m } = useI18n();
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (text: string, tone: Tone = "ok") => {
      const id = ++seq.current;
      setToasts((all) => [...all.slice(-3), { id, tone, text }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.tone === "ok" ? CheckCircle2 : t.tone === "error" ? TriangleAlert : Info;
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="animate-rise pointer-events-auto flex items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-[0_8px_24px_rgba(23,24,28,0.18)]"
            >
              <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", t.tone === "error" ? "text-accent" : "text-white/80")} />
              <span className="flex-1">{t.text}</span>
              <button type="button" onClick={() => dismiss(t.id)} aria-label={m.common.dismiss} className="-m-1 cursor-pointer rounded p-1 text-white/70 hover:text-white">
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
