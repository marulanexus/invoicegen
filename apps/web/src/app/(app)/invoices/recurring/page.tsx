import Link from "next/link";
import { ArrowLeft, Repeat } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { RecurringTable } from "@/components/documents/recurring-table";
import { requireOrgContext } from "@/server/auth/context";
import { listRecurring } from "@/server/documents/recurring-queries";

export const metadata = { title: "Recurring invoices" };

export default async function RecurringPage() {
  const ctx = await requireOrgContext();
  const rows = await listRecurring(ctx.org.id);

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" /> Back to invoices
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Recurring invoices"
        description="Automatically generate invoices on a schedule. New invoices are created as drafts."
      />

      {!ctx.plan.features.recurringInvoices && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          Recurring invoices are available on the <strong>Growth Pro</strong>{" "}
          plan.{" "}
          <Link href="/settings/billing" className="font-medium text-primary hover:underline">
            Upgrade
          </Link>{" "}
          to enable them.
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring schedules"
          description="Open an invoice and choose “Make recurring” to set one up."
          action={
            <Button asChild>
              <Link href="/invoices">Go to invoices</Link>
            </Button>
          }
        />
      ) : (
        <RecurringTable rows={rows} />
      )}
    </div>
  );
}
