import { documentTitle, type DocumentView } from "@/lib/document-view";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Read-only, paper-like rendering of a document. Mirrors the PDF layout so the
 * builder's live preview matches what the client receives.
 */
export function DocumentPreview({
  view,
  className,
}: {
  view: DocumentView;
  className?: string;
}) {
  const accent = view.accentColor || "#2563eb";
  const cur = view.currency;
  const hasTax = view.taxTotal > 0;
  const hasDiscount = view.discountTotal > 0;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[820px] bg-white text-[13px] text-slate-800 shadow-sm ring-1 ring-slate-200",
        className
      )}
      style={{ aspectRatio: "1 / 1.414" }}
    >
      <div className="flex h-full flex-col p-8 sm:p-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            {view.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.logoUrl}
                alt={view.from.name}
                className="mb-3 h-12 w-auto object-contain"
              />
            ) : (
              <div
                className="mb-3 inline-grid h-11 w-11 place-items-center rounded-lg text-lg font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {view.from.name.charAt(0).toUpperCase()}
              </div>
            )}
            <p className="text-base font-semibold text-slate-900">
              {view.from.name}
            </p>
            <div className="mt-1 space-y-0.5 text-xs text-slate-500">
              {view.from.lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
              {view.from.email && <p>{view.from.email}</p>}
              {view.from.taxId && <p>Tax ID: {view.from.taxId}</p>}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: accent }}
            >
              {documentTitle(view.type)}
            </h1>
            <p className="mt-1 font-mono text-sm text-slate-700">{view.number}</p>
            <div className="mt-3 space-y-0.5 text-xs text-slate-500">
              {view.issueDate && (
                <p>
                  <span className="text-slate-400">Issued:</span>{" "}
                  {formatDate(view.issueDate)}
                </p>
              )}
              {view.type === "invoice" && view.dueDate && (
                <p>
                  <span className="text-slate-400">Due:</span>{" "}
                  {formatDate(view.dueDate)}
                </p>
              )}
              {view.type === "quote" && view.validUntil && (
                <p>
                  <span className="text-slate-400">Valid until:</span>{" "}
                  {formatDate(view.validUntil)}
                </p>
              )}
              {view.poNumber && (
                <p>
                  <span className="text-slate-400">PO:</span> {view.poNumber}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bill to */}
        {view.billTo && (
          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Bill to
            </p>
            <p className="mt-1 font-medium text-slate-900">{view.billTo.name}</p>
            <div className="mt-0.5 space-y-0.5 text-xs text-slate-500">
              {view.billTo.lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
              {view.billTo.email && <p>{view.billTo.email}</p>}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="mt-8 flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr
                className="text-left text-[11px] font-semibold uppercase tracking-wide text-white"
                style={{ backgroundColor: accent }}
              >
                <th className="rounded-l-md px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Rate</th>
                {hasDiscount && <th className="px-3 py-2 text-right">Disc.</th>}
                {hasTax && <th className="px-3 py-2 text-right">Tax</th>}
                <th className="rounded-r-md px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {view.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2.5 text-slate-700">
                    {item.description || (
                      <span className="text-slate-300">Item description</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatCurrency(item.unitPrice, cur)}
                  </td>
                  {hasDiscount && (
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {item.discountRate ? `${item.discountRate}%` : "—"}
                    </td>
                  )}
                  {hasTax && (
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {item.taxRate ? `${item.taxRate}%` : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {formatCurrency(item.amount, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-5 flex justify-end">
            <div className="w-full max-w-[260px] space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatCurrency(view.subtotal, cur)} />
              {hasDiscount && (
                <Row
                  label="Discount"
                  value={`−${formatCurrency(view.discountTotal, cur)}`}
                />
              )}
              {hasTax && (
                <Row
                  label={`${view.taxLabel}`}
                  value={formatCurrency(view.taxTotal, cur)}
                />
              )}
              <div
                className="mt-1 flex items-center justify-between rounded-md px-3 py-2 text-base font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                <span>Total</span>
                <span className="tabular-nums">
                  {formatCurrency(view.total, cur)}
                </span>
              </div>
              {view.amountPaid > 0 && (
                <>
                  <Row
                    label="Paid"
                    value={`−${formatCurrency(view.amountPaid, cur)}`}
                  />
                  <Row
                    label="Balance due"
                    value={formatCurrency(view.balanceDue, cur)}
                    strong
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notes / terms / footer */}
        <div className="mt-8 space-y-4">
          {view.notes && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-line text-xs text-slate-600">
                {view.notes}
              </p>
            </div>
          )}
          {view.terms && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Terms & conditions
              </p>
              <p className="mt-1 whitespace-pre-line text-xs text-slate-600">
                {view.terms}
              </p>
            </div>
          )}
          {view.showPoweredBy && (
            <p className="border-t border-slate-100 pt-4 text-center text-[10px] text-slate-400">
              Powered by InvoiceGen
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3">
      <span className={cn("text-slate-500", strong && "font-semibold text-slate-800")}>
        {label}
      </span>
      <span className={cn("tabular-nums text-slate-700", strong && "font-bold text-slate-900")}>
        {value}
      </span>
    </div>
  );
}
