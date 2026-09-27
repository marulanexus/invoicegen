import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { TaxInvoiceProblem } from "@invoicegen/shared/tax-invoice";

/**
 * What must be fixed before this invoice is a valid SARS tax invoice.
 * Sending, marking as sent and sharing are blocked until the list is empty.
 */
export function TaxInvoiceChecklist({
  problems,
  clientHref,
}: {
  problems: TaxInvoiceProblem[];
  /** Where to edit the client, when a problem is about the client. */
  clientHref?: string;
}) {
  if (problems.length === 0) return null;
  return (
    <div role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        Fix before sending (SARS tax invoice rules)
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {problems.map((p) => (
          <li key={p.code}>
            {p.message}{" "}
            {p.fix === "settings" ? (
              <Link href="/settings" className="font-medium underline underline-offset-2">
                Open settings
              </Link>
            ) : p.fix === "client" && clientHref ? (
              <Link href={clientHref} className="font-medium underline underline-offset-2">
                Edit client
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
