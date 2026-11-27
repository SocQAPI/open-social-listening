import type { Metadata } from "next";
import { demoStaticParams } from "@/lib/demo/static";
import { SettingsView } from "@/components/settings/settings-view";

/** Only the static demo prerenders a project (the seeded demo, id 1); a normal install renders on request. */
export const generateStaticParams = demoStaticParams;

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsView />;
}
