import { DocumentsListScreen } from "@/components/documents/documents-list-screen";
import { requireOrgContext } from "@/server/auth/context";
import { listDocuments } from "@/server/documents/queries";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { q, status } = await searchParams;
  const documents = await listDocuments(ctx.org.id, {
    type: "invoice",
    status,
    search: q,
  });
  return (
    <DocumentsListScreen type="invoice" documents={documents} activeStatus={status ?? "all"} />
  );
}
