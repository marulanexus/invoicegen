import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentPreview } from "@/components/documents/document-preview";
import { PayNow } from "@/components/documents/pay-now";
import {
  getPublicDocument,
  markViewedByToken,
} from "@/server/documents/public";
import { statusMeta } from "@/lib/format";

export const metadata = { title: "Document" };

/** Shown after the payer comes back from PayFast/Yoco (?payment=…). */
const RETURN_MESSAGES: Record<string, { text: string; tone: "info" | "error" }> = {
  returned: {
    text: "Thanks! If your payment went through, this invoice will show as paid within a few minutes, once the payment provider confirms it.",
    tone: "info",
  },
  cancelled: { text: "Payment cancelled. You haven't been charged.", tone: "info" },
  failed: { text: "The payment didn't go through. You haven't been charged; please try again.", tone: "error" },
};

export default async function PublicDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { token } = await params;
  const { payment } = await searchParams;
  const returnMessage =
    payment && Object.hasOwn(RETURN_MESSAGES, payment) ? RETURN_MESSAGES[payment] : undefined;
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
        {returnMessage && (
          <p
            role="status"
            className={
              returnMessage.tone === "error"
                ? "mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
                : "mb-6 rounded-lg border bg-background p-3 text-sm"
            }
          >
            {returnMessage.text}
          </p>
        )}
        {doc.payment && (
          <PayNow
            token={token}
            providers={doc.payment.providers}
            balance={doc.payment.balance}
            currency={doc.payment.currency}
          />
        )}
        <DocumentPreview view={doc.view} />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by InvoiceGen
        </p>
      </main>
    </div>
  );
}
