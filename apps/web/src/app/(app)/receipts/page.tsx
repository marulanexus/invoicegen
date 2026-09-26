import { DocumentsListScreen } from "@/components/documents/documents-list-screen";
import { requireOrgContext } from "@/server/auth/context";
import { listDocuments } from "@/server/documents/queries";

export const metadata = { title: "Receipts" };

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { q, status } = await searchParams;
  const documents = await listDocuments(ctx.org.id, {
    type: "receipt",
    status,
    search: q,
  });
  return (
    <DocumentsListScreen type="receipt" documents={documents} activeStatus={status ?? "all"} />
  );
}
