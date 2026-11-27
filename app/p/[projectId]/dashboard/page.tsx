import type { Metadata } from "next";
import { demoStaticParams } from "@/lib/demo/static";
import { DashboardView } from "@/components/dashboard/dashboard-view";

/** Only the static demo prerenders a project (the seeded demo, id 1); a normal install renders on request. */
export const generateStaticParams = demoStaticParams;

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardView />;
}
