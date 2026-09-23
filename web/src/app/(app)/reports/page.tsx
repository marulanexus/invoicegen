import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  DollarSign,
  Sparkles,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireOrgContext } from "@/server/auth/context";
import {
  invoiceAging,
  revenueByClient,
  revenueByStatus,
} from "@/server/reports/queries";
import { formatCurrency } from "@/lib/money";
import { statusMeta } from "@/lib/format";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await requireOrgContext();

  if (!ctx.plan.features.advancedReporting) {
    return (
      <div>
        <PageHeader
          title="Reports"
          description="Insights into your revenue and receivables."
        />
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">
              Advanced reporting is a Business feature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upgrade to the Business Plus plan to unlock revenue breakdowns by
              client and status, plus accounts-receivable aging.
            </p>
            <Button asChild>
              <Link href="/settings/billing">
                Upgrade plan <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = ctx.profile?.defaultCurrency ?? "USD";

  const [byClient, byStatus, aging] = await Promise.all([
    revenueByClient(ctx.org.id),
    revenueByStatus(ctx.org.id),
    invoiceAging(ctx.org.id),
  ]);

  // Org-wide totals (all invoices, not just the top-10 clients table). For
  // non-draft/void invoices, paid = invoiced − outstanding since fully-paid
  // invoices contribute 0 to outstanding.
  const REAL = new Set(["sent", "viewed", "partial", "paid", "overdue"]);
  const totalInvoiced = byStatus
    .filter((r) => REAL.has(r.status))
    .reduce((sum, r) => sum + r.total, 0);
  const totalOutstanding = aging.reduce((sum, r) => sum + r.total, 0);
  const totalPaid = Math.max(0, totalInvoiced - totalOutstanding);

  const agingMax = Math.max(1, ...aging.map((r) => r.total));

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Insights into your revenue and receivables."
      />

      {/* Summary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total invoiced"
          value={formatCurrency(totalInvoiced, currency)}
          icon={BarChart3}
          accent="primary"
          hint="Excludes drafts & void"
        />
        <StatCard
          label="Total paid"
          value={formatCurrency(totalPaid, currency)}
          icon={DollarSign}
          accent="success"
          hint="Collected against invoices"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(totalOutstanding, currency)}
          icon={Wallet}
          accent="warning"
          hint="Open receivables"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Revenue by client */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue by client</CardTitle>
          </CardHeader>
          <CardContent>
            {byClient.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No invoice data yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byClient.map((row) => (
                    <TableRow key={row.clientId ?? "none"}>
                      <TableCell className="font-medium">
                        {row.clientName ?? "No client"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.invoiced, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(row.paid, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.invoiced - row.paid, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Invoices by status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices by status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No invoices yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {byStatus.map((row) => {
                  const meta = statusMeta(row.status);
                  return (
                    <li
                      key={row.status}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {row.count} {row.count === 1 ? "invoice" : "invoices"}
                        </span>
                      </div>
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(row.total, currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Accounts receivable aging */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Accounts receivable aging
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {aging.map((row) => (
                <li key={row.bucket} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.bucket}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(row.total, currency)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.round((row.total / agingMax) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
