import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentPreview } from "@/components/documents/document-preview";
import {
  getPublicDocument,
  markViewedByToken,
} from "@/server/documents/public";
import { statusMeta } from "@/lib/format";

export const metadata = { title: "Document" };

export default async function PublicDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await getPublicDocument(token);
  if (!doc) notFound();

  // Record the first open (idempotent — only flips sent → viewed).
  await markViewedByToken(token);

  const meta = statusMeta(doc.view.status ?? "");

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo href={null} />
          <div className="flex items-center gap-3">
            {doc.view.status && <Badge variant={meta.variant}>{meta.label}</Badge>}
            <Button asChild size="sm">
              <a href={`/api/public/${token}/pdf`} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" /> Download PDF
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10">
        <DocumentPreview view={doc.view} />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by InvoiceGen
        </p>
      </main>
    </div>
  );
}
