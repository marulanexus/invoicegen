import { eq } from "drizzle-orm";

import { EmailSettingsForm } from "@/components/settings/email-settings-form";
import { requireOrgContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { emailSettings } from "@/server/db/schema";
import { isResendConfigured } from "@/lib/env";

export default async function EmailSettingsPage() {
  const ctx = await requireOrgContext();
  const [settings] = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.orgId, ctx.org.id))
    .limit(1);

  return (
    <EmailSettingsForm
      settings={settings ?? null}
      platformAvailable={isResendConfigured}
    />
  );
}
