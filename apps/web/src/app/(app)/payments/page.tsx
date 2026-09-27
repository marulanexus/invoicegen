import { CreditCard } from "lucide-react";
import { amountOwed } from "@invoicegen/shared/calc";

import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import {
  RecordPaymentDialog,
  type OpenInvoiceOption,
} from "@/components/payments/record-payment-dialog";
import { requireOrgContext } from "@/server/auth/context";
import { listPayments } from "@/server/dashboard/queries";
import { listDocuments } from "@/server/documents/queries";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const ctx = await requireOrgContext();

  const [paymentsList, invoices] = await Promise.all([
    listPayments(ctx.org.id),
    listDocuments(ctx.org.id, { type: "invoice" }),
  ]);

  const openInvoices: OpenInvoiceOption[] = invoices
    .filter((d) => ["sent", "viewed", "partial", "overdue"].includes(d.status))
    .map((d) => ({
      id: d.id,
      number: d.number,
      balance: amountOwed(d),
      currency: d.currency,
    }))
    .filter((d) => d.balance > 0.001);

  const totalReceived = paymentsList.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Track money received against your invoices."
      >
        <RecordPaymentDialog invoices={openInvoices} />
      </PageHeader>

      {paymentsList.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Record a payment when a client pays an invoice."
          action={<RecordPaymentDialog invoices={openInvoices} />}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {paymentsList.length} payments
            </span>
            <span className="font-medium">
              {formatCurrency(
                totalReceived,
                ctx.profile?.defaultCurrency ?? "USD"
              )}{" "}
              received
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsList.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.paidAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/documents/${p.documentId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {p.documentNumber ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {p.clientName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden capitalize text-muted-foreground md:table-cell">
                    {p.method.replace("_", " ")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(p.amount, p.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
