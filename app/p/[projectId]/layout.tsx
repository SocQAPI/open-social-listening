"use client";

import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ProjectProvider, useProject } from "@/components/shell/project-context";
import { Sidebar } from "@/components/shell/sidebar";

function Shell({ children }: { children: ReactNode }) {
  const { projectId, projects, project, account, monthUsed, settings } = useProject();
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-wrap items-stretch bg-bg">
      <Sidebar
        projectId={projectId}
        projects={projects ? projects.map((p) => ({ id: p.id, name: p.name, isDemo: p.isDemo, paused: p.paused })) : null}
        unread={project?.counts?.unread ?? null}
        balance={account?.credits ?? null}
        monthUsed={project?.isDemo ? null : monthUsed}
        monthBudget={project && !project.isDemo && project.monthlyBudgetCredits > 0 ? project.monthlyBudgetCredits : null}
        connected={settings ? settings.apiKey.configured : null}
      />
      {/* Keyed by page, so each page's sections rise in one after another when it opens. */}
      <main key={pathname} className="stagger flex min-w-0 flex-[999_1_528px] flex-col gap-5 px-4 pt-5 pb-12 sm:px-8 md:pt-7">
        {children}
      </main>
    </div>
  );
}

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  return (
    <ProjectProvider key={projectId} projectId={projectId}>
      <Shell>{children}</Shell>
    </ProjectProvider>
  );
}
