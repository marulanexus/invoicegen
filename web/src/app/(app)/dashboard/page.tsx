import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CreditCard,
  DollarSign,
  FileText,
  Plus,
  Users,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueCard } from "@/components/dashboard/revenue-card";
import { DocumentsTable } from "@/components/documents/documents-table";
import { requireOrgContext } from "@/server/auth/context";
import {
  getDashboardMetrics,
  getRevenueSeries,
  getRevenueSeriesQuarterly,
  getUpcomingReminders,
} from "@/server/dashboard/queries";
import { listDocuments } from "@/server/documents/queries";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const currency = ctx.profile?.defaultCurrency ?? "USD";

  const [metrics, revenue, revenueQuarterly, reminders, recent] = await Promise.all([
    getDashboardMetrics(ctx.org.id),
    getRevenueSeries(ctx.org.id, 6),
    getRevenueSeriesQuarterly(ctx.org.id, 4),
    getUpcomingReminders(ctx.org.id),
    listDocuments(ctx.org.id, { type: "invoice", limit: 6 }),
  ]);

  const firstName = ctx.member.name?.split(" ")[0];

  return (
    <div>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        description="Here's how your business is doing."
      >
        <Button asChild>
          <Link href="/documents/new?type=invoice">
            <Plus className="h-4 w-4" /> New invoice
          </Link>
        </Button>
      </PageHeader>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatCurrency(metrics.totalRevenue, currency)}
          icon={DollarSign}
          accent="success"
          hint="Payments received"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(metrics.outstanding, currency)}
          icon={Wallet}
          accent="primary"
          hint="Awaiting payment"
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(metrics.overdue, currency)}
          icon={AlertTriangle}
          accent="destructive"
          hint="Past due date"
        />
        <StatCard
          label="Active clients"
          value={String(metrics.activeClients)}
          icon={Users}
          accent="primary"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Revenue chart with monthly/quarterly toggle */}
        <RevenueCard monthly={revenue} quarterly={revenueQuarterly} currency={currency} />

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickAction href="/documents/new?type=invoice" icon={FileText}>
              Create new invoice
            </QuickAction>
            <QuickAction href="/documents/new?type=quote" icon={FileText}>
              Create new quote
            </QuickAction>
            <QuickAction href="/clients/new" icon={Users}>
              Add new client
            </QuickAction>
            <QuickAction href="/payments" icon={CreditCard}>
              Record a payment
            </QuickAction>
          </CardContent>
        </Card>
      </div>

      {/* Payment reminders summary */}
      <div className="mt-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Payment reminders</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {reminders.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nothing due in the next 7 days. You&apos;re all caught up. 🎉
              </p>
            ) : (
              <ul className="divide-y">
                {reminders.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/documents/${r.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.number}
                      </Link>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {r.clientName ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="hidden text-muted-foreground sm:inline">
                        {r.dueDate ? formatDate(r.dueDate) : "—"}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(r.balance, r.currency)}
                      </span>
                      <Badge variant={r.overdue ? "destructive" : "warning"}>
                        {r.overdue ? "Overdue" : "Due soon"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent invoices */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent invoices</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/invoices">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Create your first invoice and start getting paid."
            action={
              <Button asChild>
                <Link href="/documents/new?type=invoice">
                  <Plus className="h-4 w-4" /> New invoice
                </Link>
              </Button>
            }
          />
        ) : (
          <DocumentsTable documents={recent} />
        )}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
    >
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      {children}
      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
