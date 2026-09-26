import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DocumentBuilder } from "@/components/documents/document-builder";
import { requireOrgContext } from "@/server/auth/context";
import { listClients } from "@/server/clients/queries";

export const metadata = { title: "New document" };

const VALID_TYPES = ["invoice", "quote", "receipt"] as const;

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; clientId?: string }>;
}) {
  const ctx = await requireOrgContext();
  if (!ctx.profile) redirect("/onboarding");

  const { type, clientId } = await searchParams;
  const docType = (VALID_TYPES as readonly string[]).includes(type ?? "")
    ? (type as (typeof VALID_TYPES)[number])
    : "invoice";

  const clients = await listClients(ctx.org.id, { status: "active" });
  const label = docType.charAt(0).toUpperCase() + docType.slice(1);

  return (
    <div>
      <PageHeader
        title={`New ${label.toLowerCase()}`}
        description="Fill in the details on the left and watch the preview update live."
      />
      <DocumentBuilder
        profile={ctx.profile}
        clients={clients}
        showPoweredBy={!ctx.plan.features.customBranding}
        defaultType={docType}
        defaultClientId={clientId}
      />
    </div>
  );
}
