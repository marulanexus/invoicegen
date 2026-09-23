import { DocumentsListScreen } from "@/components/documents/documents-list-screen";
import { requireOrgContext } from "@/server/auth/context";
import { listDocuments } from "@/server/documents/queries";

export const metadata = { title: "Quotes" };

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { q, status } = await searchParams;
  const documents = await listDocuments(ctx.org.id, {
    type: "quote",
    status,
    search: q,
  });
  return (
    <DocumentsListScreen type="quote" documents={documents} activeStatus={status ?? "all"} />
  );
}
