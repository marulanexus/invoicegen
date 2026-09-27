import type { DocumentStatus, PaymentMethod } from '@invoicegen/shared/api';

export { formatCurrency } from '@invoicegen/shared/money';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const STATUS: Record<DocumentStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  viewed: { label: 'Viewed', tone: 'info' },
  partial: { label: 'Part paid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'danger' },
  void: { label: 'Void', tone: 'neutral' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  bank_transfer: 'EFT / bank transfer',
  cash: 'Cash',
  card: 'Card',
  payfast: 'PayFast',
  yoco: 'Yoco',
  paypal: 'PayPal',
  stripe: 'Stripe',
  other: 'Other',
};

/** "12 Oct 2026" for a YYYY-MM-DD or ISO date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Today in the phone's time zone as YYYY-MM-DD (the server's default is UTC). */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function balanceOf(doc: { total: string; amountPaid: string }): number {
  return Math.max(Math.round((Number(doc.total) - Number(doc.amountPaid)) * 100) / 100, 0);
}
