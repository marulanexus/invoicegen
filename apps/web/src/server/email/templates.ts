import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";
import type { DocumentView } from "@/lib/document-view";

interface BuildArgs {
  view: DocumentView;
  businessName: string;
  message?: string;
  viewUrl?: string;
}

const TITLE: Record<DocumentView["type"], string> = {
  invoice: "Invoice",
  quote: "Quote",
  receipt: "Receipt",
};

export function defaultSubject(view: DocumentView, businessName: string): string {
  return `${TITLE[view.type]} ${view.number} from ${businessName}`;
}

export type EmailTemplateKind = "invoice" | "quote" | "receipt" | "reminder";

/** Variables an org can use in custom email templates. */
export const TEMPLATE_VARIABLES = [
  "{{businessName}}",
  "{{clientName}}",
  "{{number}}",
  "{{total}}",
  "{{balance}}",
  "{{dueDate}}",
  "{{documentType}}",
] as const;

/** Default editable templates seeded into the editor. */
export const DEFAULT_EMAIL_TEMPLATES: Record<
  EmailTemplateKind,
  { subject: string; body: string }
> = {
  invoice: {
    subject: "Invoice {{number}} from {{businessName}}",
    body: "Hi {{clientName}},\n\nPlease find invoice {{number}} attached. The total due is {{balance}}, due by {{dueDate}}.\n\nThank you for your business!\n{{businessName}}",
  },
  quote: {
    subject: "Quote {{number}} from {{businessName}}",
    body: "Hi {{clientName}},\n\nPlease find quote {{number}} attached for {{total}}. Let us know if you have any questions.\n\nKind regards,\n{{businessName}}",
  },
  receipt: {
    subject: "Receipt {{number}} from {{businessName}}",
    body: "Hi {{clientName}},\n\nPlease find receipt {{number}} attached. Thank you for your payment.\n\n{{businessName}}",
  },
  reminder: {
    subject: "Reminder: invoice {{number}} from {{businessName}}",
    body: "Hi {{clientName}},\n\nThis is a friendly reminder that invoice {{number}} ({{balance}} outstanding) is due {{dueDate}}.\n\nThank you,\n{{businessName}}",
  },
};

/** Substitute {{variables}} in a template string. */
export function interpolate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

/** Escape a string for safe interpolation into HTML. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Build the variable map for a document. */
export function templateVars(
  view: DocumentView,
  businessName: string,
  clientName?: string | null
): Record<string, string> {
  return {
    businessName,
    clientName: clientName ?? "there",
    number: view.number,
    total: formatCurrency(view.total, view.currency),
    balance: formatCurrency(view.balanceDue || view.total, view.currency),
    dueDate: view.dueDate ? formatDate(view.dueDate) : "on receipt",
    documentType: TITLE[view.type].toLowerCase(),
  };
}

export function defaultMessage(view: DocumentView): string {
  const noun = TITLE[view.type].toLowerCase();
  if (view.type === "invoice") {
    return `Please find your ${noun} attached. The total due is ${formatCurrency(
      view.balanceDue || view.total,
      view.currency
    )}${view.dueDate ? `, due by ${formatDate(view.dueDate)}` : ""}. Thank you for your business!`;
  }
  if (view.type === "quote") {
    return `Please find your ${noun} attached for ${formatCurrency(
      view.total,
      view.currency
    )}. Let us know if you have any questions.`;
  }
  return `Please find your ${noun} attached. Thank you for your payment.`;
}

/** Build a clean, branded HTML email body. */
export function buildDocumentEmail({
  view,
  businessName,
  message,
  viewUrl,
}: BuildArgs): string {
  const accent = view.accentColor || "#2563eb";
  // Escape all user/tenant-controlled values before injecting into HTML.
  const body = escapeHtml(message?.trim() || defaultMessage(view)).replace(
    /\n/g,
    "<br/>"
  );
  const safeBusiness = escapeHtml(businessName);
  const safeNumber = escapeHtml(view.number);
  const amount = escapeHtml(formatCurrency(view.total, view.currency));
  const button = viewUrl
    ? `<a href="${encodeURI(viewUrl)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:10px 20px;border-radius:8px;margin:8px 0 4px">View ${TITLE[view.type].toLowerCase()} online</a>`
    : "";

  return `
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#334155">
    <div style="border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
      <div style="background:${accent};padding:20px 24px">
        <p style="margin:0;color:#fff;font-size:18px;font-weight:bold">${safeBusiness}</p>
      </div>
      <div style="padding:24px">
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px">${body}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr>
            <td style="padding:6px 0;color:#64748b">Document</td>
            <td style="padding:6px 0;text-align:right;font-weight:bold">${TITLE[view.type]} ${safeNumber}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b">Amount</td>
            <td style="padding:6px 0;text-align:right;font-weight:bold">${amount}</td>
          </tr>
          ${
            view.type === "invoice" && view.dueDate
              ? `<tr><td style="padding:6px 0;color:#64748b">Due date</td><td style="padding:6px 0;text-align:right">${formatDate(
                  view.dueDate
                )}</td></tr>`
              : ""
          }
        </table>
        ${button}
        <p style="font-size:13px;color:#64748b;margin:16px 0 0">
          The full ${TITLE[view.type].toLowerCase()} is attached as a PDF.
        </p>
      </div>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px">
      Sent with InvoiceGen
    </p>
  </div>`;
}
