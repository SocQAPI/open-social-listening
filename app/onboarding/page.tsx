import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingView } from "@/components/onboarding/onboarding-view";

export const metadata: Metadata = { title: "Set up" };

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingView />
    </Suspense>
  );
}
