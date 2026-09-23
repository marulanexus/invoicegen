import { redirect } from "next/navigation";

import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { requireOrgContext } from "@/server/auth/context";

export default async function BusinessSettingsPage() {
  const ctx = await requireOrgContext();
  if (!ctx.profile) redirect("/onboarding");
  return <BusinessProfileForm profile={ctx.profile} />;
}
