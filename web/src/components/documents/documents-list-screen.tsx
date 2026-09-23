import Link from "next/link";
import { FileText, Plus, Repeat } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { DocumentsTable } from "@/components/documents/documents-table";
import { cn } from "@/lib/utils";
import type { DocumentListItem, DocumentType } from "@/server/documents/queries";

const STATUS_FILTERS: Record<DocumentType, { value: string; label: string }[]> = {
  invoice: [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "partial", label: "Partial" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
  ],
  quote: [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "accepted", label: "Accepted" },
    { value: "declined", label: "Declined" },
  ],
  receipt: [{ value: "all", label: "All" }],
};

const COPY: Record<DocumentType, { title: string; description: string; noun: string }> = {
  invoice: {
    title: "Invoices",
    description: "Create, send and track payment on your invoices.",
    noun: "invoice",
  },
  quote: {
    title: "Quotes",
    description: "Send estimates and convert them into invoices.",
    noun: "quote",
  },
  receipt: {
    title: "Receipts",
    description: "Proof-of-payment receipts for your clients.",
    noun: "receipt",
  },
};

export function DocumentsListScreen({
  type,
  documents,
  activeStatus = "all",
}: {
  type: DocumentType;
  documents: DocumentListItem[];
  activeStatus?: string;
}) {
  const copy = COPY[type];
  const filters = STATUS_FILTERS[type];
  const newHref = `/documents/new?type=${type}`;

  return (
    <div>
      <PageHeader title={copy.title} description={copy.description}>
        {type === "invoice" && (
          <Button variant="outline" asChild>
            <Link href="/invoices/recurring">
              <Repeat className="h-4 w-4" /> Recurring
            </Link>
          </Button>
        )}
        <Button asChild>
          <Link href={newHref}>
            <Plus className="h-4 w-4" /> New {copy.noun}
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {filters.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => {
              const href =
                f.value === "all"
                  ? `/${type}s`
                  : `/${type}s?status=${f.value}`;
              const active = activeStatus === f.value;
              return (
                <Link
                  key={f.value}
                  href={href}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        )}
        <SearchInput placeholder={`Search ${copy.noun}s…`} />
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${copy.noun}s yet`}
          description={`Create your first ${copy.noun} — it only takes a minute.`}
          action={
            <Button asChild>
              <Link href={newHref}>
                <Plus className="h-4 w-4" /> New {copy.noun}
              </Link>
            </Button>
          }
        />
      ) : (
        <DocumentsTable documents={documents} />
      )}
    </div>
  );
}
