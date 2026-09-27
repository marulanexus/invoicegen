"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleSlash,
  Download,
  FileOutput,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Document } from "@/server/db/schema";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  changeDocumentStatus,
  convertQuoteToInvoice,
  deleteDocument,
} from "@/server/documents/actions";

export function DocumentActions({
  id,
  type,
  status,
  locked = false,
  onSend,
}: {
  id: string;
  type: Document["type"];
  status: string;
  /** Issued SA tax invoice: no edit/reopen/void/delete (use credit/debit notes). */
  locked?: boolean;
  onSend?: () => void;
}) {
  const isNote = type === "credit_note" || type === "debit_note";
  const listHref = isNote ? "/invoices" : `/${type}s`;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: Parameters<typeof changeDocumentStatus>[1], msg: string) {
    startTransition(async () => {
      const res = await changeDocumentStatus(id, action);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      toast.success(msg);
      router.refresh();
    });
  }

  function convert() {
    startTransition(async () => {
      const res = await convertQuoteToInvoice(id);
      if (!res.ok || !res.id) {
        toast.error(res.error ?? "Failed");
        return;
      }
      toast.success("Invoice created from quote");
      router.push(`/documents/${res.id}`);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteDocument(id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      toast.success("Document deleted");
      router.push(listHref);
      router.refresh();
    });
  }

  const isPaid = status === "paid";
  const canMarkPaid = type !== "quote" && !isNote && !isPaid && status !== "void";

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" asChild>
        <a href={`/api/documents/${id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4" /> PDF
        </a>
      </Button>

      {onSend && (
        <Button onClick={onSend} disabled={pending}>
          <Send className="h-4 w-4" /> Send
        </Button>
      )}

      {/* Issued notes are final: only PDF and send. */}
      {!isNote && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={pending} aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {!locked && (
            <DropdownMenuItem onClick={() => router.push(`/documents/${id}/edit`)}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
          )}

          {status === "draft" && (
            <DropdownMenuItem onClick={() => run("send", "Marked as sent")}>
              <Send className="h-4 w-4" /> Mark as sent
            </DropdownMenuItem>
          )}
          {canMarkPaid && (
            <DropdownMenuItem onClick={() => run("mark_paid", "Marked as paid")}>
              <Check className="h-4 w-4" /> Mark as paid
            </DropdownMenuItem>
          )}
          {type === "quote" && (
            <>
              <DropdownMenuItem onClick={() => run("accept", "Quote accepted")}>
                <ThumbsUp className="h-4 w-4" /> Mark accepted
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => run("decline", "Quote declined")}>
                <ThumbsDown className="h-4 w-4" /> Mark declined
              </DropdownMenuItem>
              <DropdownMenuItem onClick={convert}>
                <FileOutput className="h-4 w-4" /> Convert to invoice
              </DropdownMenuItem>
            </>
          )}
          {status !== "draft" && !locked && (
            <DropdownMenuItem onClick={() => run("reopen", "Reopened as draft")}>
              <RotateCcw className="h-4 w-4" /> Reopen as draft
            </DropdownMenuItem>
          )}
          {status !== "void" && !locked && (
            <DropdownMenuItem onClick={() => run("void", "Voided")}>
              <CircleSlash className="h-4 w-4" /> Void
            </DropdownMenuItem>
          )}

          {!locked && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      <Link href={listHref} className="sr-only">
        Back to list
      </Link>
    </div>
  );
}
