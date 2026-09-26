import Link from "next/link";
import { Plus, Users } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireOrgContext } from "@/server/auth/context";
import { listClients } from "@/server/clients/queries";
import { formatCurrency } from "@/lib/money";
import { initials } from "@/lib/format";

export const metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { q, status } = await searchParams;
  const clients = await listClients(ctx.org.id, {
    search: q,
    status: (status as "active" | "archived" | "all") ?? "active",
  });
  const currency = ctx.profile?.defaultCurrency ?? "USD";

  return (
    <div>
      <PageHeader title="Clients" description="Your customer directory and billing relationships.">
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="h-4 w-4" /> Add client
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <SearchInput placeholder="Search clients…" />
          <div className="flex gap-1.5">
            {[
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "all", label: "All" },
            ].map((f) => {
              const current = status ?? "active";
              const href =
                f.value === "active"
                  ? "/clients"
                  : `/clients?status=${f.value}`;
              return (
                <Link
                  key={f.value}
                  href={href}
                  className={
                    "rounded-full border px-3 py-1 text-sm transition-colors " +
                    (current === f.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent")
                  }
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {clients.length} {clients.length === 1 ? "client" : "clients"}
        </p>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "No matching clients" : "No clients yet"}
          description={
            q
              ? "Try a different search term."
              : "Add your first client to start sending invoices in seconds."
          }
          action={
            !q && (
              <Button asChild>
                <Link href="/clients/new">
                  <Plus className="h-4 w-4" /> Add client
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Documents</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/clients/${c.id}`} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.name}</span>
                        {c.contactName && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.contactName}
                          </span>
                        )}
                      </span>
                      {c.status === "archived" && (
                        <Badge variant="outline" className="ml-1">Archived</Badge>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {c.email ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {c.stats.documentCount}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(c.stats.outstanding, c.currency ?? currency)}
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
