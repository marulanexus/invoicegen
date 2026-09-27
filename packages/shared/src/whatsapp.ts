/**
 * WhatsApp sharing, shared by the web app and the mobile app so both send the
 * same message. Uses WhatsApp's public click-to-chat links (wa.me).
 */

/**
 * A WhatsApp number in international format without "+", or null. Local
 * South African numbers (0XX XXX XXXX) become 27XXXXXXXXX.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `27${digits.slice(1)}`;
  if (/^\d{10,15}$/.test(digits)) return digits;
  return null;
}

/**
 * Click-to-chat link: straight to the client's chat when we have a usable
 * number, otherwise WhatsApp asks who to send it to.
 */
export function whatsappUrl(message: string, phone?: string | null): string {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(message)}`;
}

const TYPE_WORD = {
  invoice: "invoice",
  quote: "quote",
  receipt: "receipt",
  credit_note: "credit note",
  debit_note: "debit note",
} as const;

export interface ShareMessageInput {
  type: keyof typeof TYPE_WORD;
  number: string;
  /** Already formatted, e.g. "R 1 150,00". */
  total: string;
  url: string;
  businessName?: string | null;
  clientName?: string | null;
  /** Already formatted; only mentioned for invoices. */
  dueDate?: string | null;
}

/** The message sent with a document's link. */
export function shareMessage(m: ShareMessageInput): string {
  const greeting = m.clientName?.trim() ? `Hi ${m.clientName.trim()},` : "Hi,";
  const from = m.businessName?.trim() ? ` from ${m.businessName.trim()}` : "";
  const due = m.type === "invoice" && m.dueDate ? `, due ${m.dueDate}` : "";
  const action = m.type === "invoice" ? "View and pay here" : "View it here";
  return [greeting, `here is ${TYPE_WORD[m.type]} ${m.number}${from} for ${m.total}${due}.`, `${action}: ${m.url}`].join("\n");
}
