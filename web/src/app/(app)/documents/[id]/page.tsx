import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DocumentPreview } from "@/components/documents/document-preview";
import { DocumentDetailActions } from "@/components/documents/document-detail-actions";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { RecurringDialog } from "@/components/documents/recurring-dialog";
import { CopyLink } from "@/components/documents/copy-link";
import { requireOrgContext } from "@/server/auth/context";
import { getDocument } from "@/server/documents/queries";
import { viewFromStored } from "@/lib/document-view";
import { formatCurrency } from "@/lib/money";
import { formatDate, statusMeta } from "@/lib/format";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const full = await getDocument(ctx.org.id, id);
  if (!full) notFound();

  const { document: doc, client, items, payments } = full;
  const view = viewFromStored(doc, items, {
    showPoweredBy: !ctx.plan.features.customBranding,
  });
  const meta = statusMeta(doc.status);
  const balance = Number(doc.total) - Number(doc.amountPaid);

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href={`/${doc.type}s`}>
            <ArrowLeft className="h-4 w-4" /> Back to {doc.type}s
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{doc.number}</h1>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <DocumentDetailActions
          id={doc.id}
          type={doc.type}
          status={doc.status}
          number={doc.number}
          defaultEmail={client?.email}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Preview */}
        <div className="order-2 rounded-xl bg-muted/40 p-3 sm:p-5 lg:order-1">
          <DocumentPreview view={view} />
        </div>

        {/* Meta sidebar */}
        <div className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Meta label="Client">
                {client ? (
                  <Link href={`/clients/${client.id}`} className="text-primary hover:underline">
                    {client.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Meta>
              <Meta label="Issued">{formatDate(doc.issueDate)}</Meta>
              {doc.type === "invoice" && (
                <Meta label="Due">{formatDate(doc.dueDate)}</Meta>
              )}
              {doc.type === "quote" && (
                <Meta label="Valid until">{formatDate(doc.validUntil)}</Meta>
              )}
              <Separator />
              <Meta label="Total">
                <span className="font-semibold">
                  {formatCurrency(doc.total, doc.currency)}
                </span>
              </Meta>
              <Meta label="Paid">{formatCurrency(doc.amountPaid, doc.currency)}</Meta>
              <Meta label="Balance">
                <span className="font-semibold">
                  {formatCurrency(balance, doc.currency)}
                </span>
              </Meta>
            </CardContent>
          </Card>

          {doc.publicToken && <CopyLink token={doc.publicToken} />}

          {doc.type === "invoice" && ctx.plan.features.recurringInvoices && (
            <RecurringDialog invoiceId={doc.id} />
          )}

          {doc.type === "invoice" && balance > 0.001 && doc.status !== "void" && (
            <RecordPaymentDialog
              invoices={[
                {
                  id: doc.id,
                  number: doc.number,
                  balance,
                  currency: doc.currency,
                },
              ]}
              defaultDocumentId={doc.id}
              triggerLabel="Record payment"
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {formatDate(p.paidAt)} · {p.method.replace("_", " ")}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(p.amount, p.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
