import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DocumentBuilder } from "@/components/documents/document-builder";
import { requireOrgContext } from "@/server/auth/context";
import { getDocument } from "@/server/documents/queries";
import { listClients } from "@/server/clients/queries";

export const metadata = { title: "Edit document" };

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  if (!ctx.profile) redirect("/onboarding");

  const full = await getDocument(ctx.org.id, id);
  if (!full) notFound();

  const clients = await listClients(ctx.org.id, { status: "active" });

  return (
    <div>
      <PageHeader title={`Edit ${full.document.number}`} />
      <DocumentBuilder
        profile={ctx.profile}
        clients={clients}
        showPoweredBy={!ctx.plan.features.customBranding}
        existing={{ document: full.document, items: full.items }}
      />
    </div>
  );
}
