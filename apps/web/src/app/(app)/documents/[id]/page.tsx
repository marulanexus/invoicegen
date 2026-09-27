import Link from "next/link";
import { amountOwed, effectiveTotal } from "@invoicegen/shared/calc";
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
import { WhatsAppShare } from "@/components/documents/whatsapp-share";
import { requireOrgContext } from "@/server/auth/context";
import { getDocument } from "@/server/documents/queries";
import { asIssued, getTaxInvoiceStatus } from "@/server/documents/tax-invoice";
import { TaxInvoiceChecklist } from "@/components/documents/tax-invoice-checklist";
import { NoteDialog } from "@/components/documents/note-dialog";
import { isLockedTaxInvoice, isNote } from "@/server/documents/rules";
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

  const { client, items, payments } = full;
  // Drafts preview with the details they'd be issued with today.
  const doc = await asIssued(ctx, full.document);
  const taxStatus = doc.status === "draft" ? await getTaxInvoiceStatus(ctx, doc, items) : null;
  const view = viewFromStored(doc, items, {
    related: full.related,
    showPoweredBy: !ctx.plan.features.customBranding,
  });
  const meta = statusMeta(doc.status);
  const balance = amountOwed(doc);
  const note = isNote(doc);
  // Issued tax invoices and notes are final: corrections go through notes.
  const locked = note || isLockedTaxInvoice(doc);
  const adjusted = Number(doc.adjustmentTotal) !== 0;
  const canIssueNotes = doc.type === "invoice" && doc.status !== "draft" && doc.status !== "void";
  // Paid more than the invoice is now worth (e.g. credited after payment).
  const refundDue = !note ? Math.round((Number(doc.amountPaid) - effectiveTotal(doc)) * 100) / 100 : 0;
  const backHref = note && full.related ? `/documents/${full.related.id}` : note ? "/invoices" : `/${doc.type}s`;
  const backLabel = note && full.related ? `Back to ${full.related.number}` : note ? "Back to invoices" : `Back to ${doc.type}s`;

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{doc.number}</h1>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <DocumentDetailActions
          locked={locked}
          id={doc.id}
          type={doc.type}
          status={doc.status}
          number={doc.number}
          defaultEmail={client?.email}
        />
      </div>

      {taxStatus && taxStatus.problems.length > 0 ? (
        <div className="mb-6">
          <TaxInvoiceChecklist
            problems={taxStatus.problems}
            clientHref={client ? `/clients/${client.id}/edit` : undefined}
          />
        </div>
      ) : null}

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
              {note && full.related && (
                <Meta label="For invoice">
                  <Link href={`/documents/${full.related.id}`} className="text-primary hover:underline">
                    {full.related.number}
                  </Link>
                </Meta>
              )}
              {note && doc.reason && <Meta label="Reason">{doc.reason}</Meta>}
              <Separator />
              <Meta label={note ? "Amount" : "Total"}>
                <span className="font-semibold">
                  {formatCurrency(doc.total, doc.currency)}
                </span>
              </Meta>
              {adjusted && (
                <Meta label="Credit/debit notes">
                  {Number(doc.adjustmentTotal) < 0 ? "−" : "+"}
                  {formatCurrency(Math.abs(Number(doc.adjustmentTotal)), doc.currency)}
                </Meta>
              )}
              {!note && (
                <>
                  <Meta label="Paid">{formatCurrency(doc.amountPaid, doc.currency)}</Meta>
                  <Meta label="Balance">
                    <span className="font-semibold">
                      {formatCurrency(balance, doc.currency)}
                    </span>
                  </Meta>
                  {refundDue > 0.005 && (
                    <Meta label="Refund due to client">
                      <span className="font-semibold text-warning-foreground">
                        {formatCurrency(refundDue, doc.currency)}
                      </span>
                    </Meta>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {doc.status !== "void" && (
            <div className="space-y-2">
              <WhatsAppShare
                id={doc.id}
                isDraft={doc.status === "draft"}
                phone={client?.phone}
                message={{
                  type: doc.type,
                  number: doc.number,
                  total: formatCurrency(doc.total, doc.currency),
                  businessName: ctx.profile?.displayName ?? ctx.org.name,
                  clientName: client?.name ?? (typeof doc.billToSnapshot?.name === "string" ? doc.billToSnapshot.name : null),
                  dueDate: doc.dueDate ? formatDate(doc.dueDate) : null,
                }}
              />
              <CopyLink id={doc.id} isDraft={doc.status === "draft"} />
            </div>
          )}

          {(canIssueNotes || full.notes.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Credit &amp; debit notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {full.notes.length === 0 ? (
                  <p className="text-muted-foreground">
                    {locked
                      ? "This tax invoice is issued, so it can't be edited. Correct or cancel it with a note."
                      : "Correct or cancel this invoice with a note."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {full.notes.map((n) => (
                      <li key={n.id} className="flex items-center justify-between gap-2">
                        <Link href={`/documents/${n.id}`} className="text-primary hover:underline">
                          {n.number}
                        </Link>
                        <span className="font-medium tabular-nums">
                          {n.type === "credit_note" ? "−" : "+"}
                          {formatCurrency(n.total, n.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {canIssueNotes && effectiveTotal(doc) > 0.005 && (
                  <NoteDialog
                    kind="credit"
                    invoiceId={doc.id}
                    invoiceNumber={doc.number}
                    remaining={effectiveTotal(doc)}
                    currency={doc.currency}
                    taxLabel={doc.taxLabel ?? "VAT"}
                  />
                )}
                {canIssueNotes && (
                  <NoteDialog
                    kind="debit"
                    invoiceId={doc.id}
                    invoiceNumber={doc.number}
                    remaining={effectiveTotal(doc)}
                    currency={doc.currency}
                    taxLabel={doc.taxLabel ?? "VAT"}
                  />
                )}
              </CardContent>
            </Card>
          )}

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

          {!note && (
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
          )}
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
