import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { requireOrgContext } from "@/server/auth/context";
import { getClient } from "@/server/clients/queries";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const client = await getClient(ctx.org.id, id);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${client.name}`} />
      <ClientForm client={client} />
    </div>
  );
}
