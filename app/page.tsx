"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/ui/api";
import { LogoMark } from "@/components/shell/logo";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n";

interface ProjectSummary {
  id: number;
  isDemo: boolean;
}

/** Entry point: open the newest real project, else the demo, else onboarding. */
export default function Home() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { m } = useI18n();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items } = await api<{ items: ProjectSummary[] }>("/api/projects");
        if (cancelled) return;
        const real = items.filter((p) => !p.isDemo).sort((a, b) => b.id - a.id)[0];
        const target = real ?? items[0];
        router.replace(target ? `/p/${target.id}/inbox` : "/onboarding");
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-ink-3">
      <LogoMark size={40} />
      {error ? (
        <p role="alert" className="m-0 max-w-sm text-center">
          {error}
        </p>
      ) : (
        <span className="inline-flex items-center gap-2">
          <Spinner className="size-4" />
          {m.common.loading}
        </span>
      )}
    </main>
  );
}
