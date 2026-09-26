/**
 * Money helpers. Amounts are stored in Postgres as `numeric(14,2)` and surface
 * in JS as strings. We do arithmetic in integer "cents" to avoid float drift,
 * then format back to fixed-2 decimal strings for storage.
 */

/** Parse a numeric string/number into a safe number (2dp domain). */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Round to 2 decimals using integer cents (avoids 0.1 + 0.2 issues). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Format a number as a fixed 2-decimal string for `numeric` columns. */
export function toMoneyString(n: number): string {
  return round2(n).toFixed(2);
}

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  ZAR: "en-ZA",
  AUD: "en-AU",
  CAD: "en-CA",
  INR: "en-IN",
  NGN: "en-NG",
  KES: "en-KE",
  JPY: "ja-JP",
};

/** Human-readable currency formatting (e.g. "$1,250.00"). */
export function formatCurrency(
  value: string | number | null | undefined,
  currency = "USD"
): string {
  const amount = toNumber(value);
  const locale = CURRENCY_LOCALES[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to plain number with the code prefix.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export const SUPPORTED_CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "ZAR", label: "South African Rand", symbol: "R" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "NGN", label: "Nigerian Naira", symbol: "₦" },
  { code: "KES", label: "Kenyan Shilling", symbol: "KSh" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
] as const;
