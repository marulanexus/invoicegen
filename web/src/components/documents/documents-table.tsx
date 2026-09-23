import Link from "next/link";

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
import { formatCurrency } from "@/lib/money";
import { formatDate, statusMeta } from "@/lib/format";
import type { DocumentListItem } from "@/server/documents/queries";

export function DocumentsTable({
  documents,
  showClient = true,
}: {
  documents: DocumentListItem[];
  showClient?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            {showClient && (
              <TableHead className="hidden sm:table-cell">Client</TableHead>
            )}
            <TableHead className="hidden md:table-cell">Issued</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((d) => {
            const meta = statusMeta(d.status);
            return (
              <TableRow key={d.id}>
                <TableCell>
                  <Link
                    href={`/documents/${d.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {d.number}
                  </Link>
                  {d.type !== "invoice" && (
                    <span className="ml-2 text-xs uppercase text-muted-foreground">
                      {d.type}
                    </span>
                  )}
                </TableCell>
                {showClient && (
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {d.clientName ?? "—"}
                  </TableCell>
                )}
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(d.issueDate)}
                </TableCell>
                <TableCell>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(d.total, d.currency)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
