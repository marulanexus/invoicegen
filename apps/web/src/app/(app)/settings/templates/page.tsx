import { EmailTemplatesForm } from "@/components/settings/email-templates-form";
import { requireOrgContext } from "@/server/auth/context";
import { getEmailTemplates } from "@/server/email/template-store";

export default async function TemplatesSettingsPage() {
  const ctx = await requireOrgContext();
  const templates = await getEmailTemplates(ctx.org.id);
  return <EmailTemplatesForm templates={templates} />;
}
