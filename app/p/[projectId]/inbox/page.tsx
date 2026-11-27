import type { Metadata } from "next";
import { demoStaticParams } from "@/lib/demo/static";
import { InboxView } from "@/components/inbox/inbox-view";

/** Only the static demo prerenders a project (the seeded demo, id 1); a normal install renders on request. */
export const generateStaticParams = demoStaticParams;

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return <InboxView />;
}
