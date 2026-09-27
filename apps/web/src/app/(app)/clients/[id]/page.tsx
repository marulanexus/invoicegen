import Link from "next/link";
import { amountOwed } from "@invoicegen/shared/calc";
import { notFound } from "next/navigation";
import {
  Building2,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentsTable } from "@/components/documents/documents-table";
import { ClientActions } from "@/components/clients/client-actions";
import { requireOrgContext } from "@/server/auth/context";
import { getClient } from "@/server/clients/queries";
import { listDocuments } from "@/server/documents/queries";
import { formatCurrency } from "@/lib/money";
import { initials } from "@/lib/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const client = await getClient(ctx.org.id, id);
  if (!client) notFound();

  const docs = await listDocuments(ctx.org.id, { clientId: id });
  const currency = client.currency ?? ctx.profile?.defaultCurrency ?? "USD";

  const outstanding = docs
    .filter(
      (d) =>
        d.type === "invoice" &&
        ["sent", "viewed", "partial", "overdue"].includes(d.status)
    )
    .reduce((sum, d) => sum + amountOwed(d), 0);
  const totalPaid = docs.reduce((sum, d) => sum + Number(d.amountPaid), 0);

  const addr = [
    client.addressLine1,
    client.addressLine2,
    [client.city, client.state].filter(Boolean).join(", "),
    client.postalCode,
    client.country,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader title={client.name} description={client.companyName ?? undefined}>
        <Button variant="outline" asChild>
          <Link href={`/documents/new?type=invoice&clientId=${client.id}`}>
            <Plus className="h-4 w-4" /> New invoice
          </Link>
        </Button>
        <ClientActions clientId={client.id} status={client.status} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                  {initials(client.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{client.name}</p>
                  {client.status === "archived" && (
                    <Badge variant="outline">Archived</Badge>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                {client.contactName && (
                  <Row icon={Building2}>{client.contactName}</Row>
                )}
                {client.email && (
                  <Row icon={Mail}>
                    <a href={`mailto:${client.email}`} className="hover:underline">
                      {client.email}
                    </a>
                  </Row>
                )}
                {client.phone && <Row icon={Phone}>{client.phone}</Row>}
                {addr.length > 0 && (
                  <Row icon={MapPin}>
                    <span className="whitespace-pre-line">{addr.join("\n")}</span>
                  </Row>
                )}
              </div>

              {client.tags && client.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {client.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              {client.notes && (
                <div className="mt-5 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  {client.notes}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: stats + documents */}
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Outstanding"
              value={formatCurrency(outstanding, currency)}
              icon={CreditCard}
              accent="warning"
            />
            <StatCard
              label="Total paid"
              value={formatCurrency(totalPaid, currency)}
              icon={CreditCard}
              accent="success"
            />
            <StatCard
              label="Documents"
              value={String(docs.length)}
              icon={FileText}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Documents</CardTitle>
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/documents/new?type=invoice&clientId=${client.id}`}>
                  <Plus className="h-4 w-4" /> New
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {docs.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents yet"
                  description="Create an invoice, quote or receipt for this client."
                />
              ) : (
                <DocumentsTable documents={docs} showClient={false} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-muted-foreground">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="text-foreground">{children}</span>
    </div>
  );
}
