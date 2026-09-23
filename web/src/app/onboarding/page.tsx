import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getOrgContext } from "@/server/auth/context";
import { isClerkConfigured } from "@/lib/env";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  if (!isClerkConfigured) redirect("/sign-in");

  const ctx = await getOrgContext();
  if (!ctx) redirect("/sign-in");
  if (ctx.onboardingCompleted) redirect("/dashboard");

  return (
    <OnboardingWizard
      defaults={{
        displayName: ctx.profile?.displayName ?? "",
        email: ctx.profile?.email ?? ctx.member.email ?? "",
      }}
    />
  );
}
