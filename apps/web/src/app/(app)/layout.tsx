import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { getOrgContext } from "@/server/auth/context";
import { isClerkConfigured } from "@/lib/env";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isClerkConfigured) {
    // Without auth configured there is no tenant to load — send to setup notice.
    redirect("/sign-in");
  }

  const ctx = await getOrgContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.onboardingCompleted) redirect("/onboarding");

  return (
    <AppShell
      planName={ctx.plan.name}
      isFreePlan={ctx.plan.id === "free"}
      orgName={ctx.profile?.displayName ?? ctx.org.name}
    >
      {children}
    </AppShell>
  );
}
