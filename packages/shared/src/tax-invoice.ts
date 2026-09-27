/**
 * South African tax invoice rules (VAT Act 89 of 1991, s20 — see SARS
 * Interpretation Note 83, Issue 3, 30 Sep 2024, which quotes the section).
 *
 * - Only a registered VAT vendor may issue a tax invoice (s20(1)).
 * - A full tax invoice (s20(4)) is valid at any amount and required above
 *   R5 000; it must be in rand unless the supply is zero-rated under s11, and
 *   must show the recipient's name and address (and VAT number if they're a
 *   vendor). An abridged invoice (s20(5), ≤ R5 000) may omit the recipient,
 *   but not for zero-rated supplies.
 *
 * We always produce the full format, and only check what a full tax invoice
 * needs for the amount and currency involved. Pure functions: shared by the
 * web preview/PDF, the API and the mobile app.
 */

/** Standard VAT rate in South Africa (%). */
export const ZA_VAT_RATE = 15;

/** Above this consideration (ZAR) the recipient's details are required (s20(4)/(5)). */
export const ZA_FULL_INVOICE_THRESHOLD = 5000;

const ZA_NAMES = new Set(["za", "zaf", "rsa", "south africa", "suid-afrika", "republic of south africa"]);

/** Whether a business/client country value means South Africa. */
export function isSouthAfrica(country: string | null | undefined): boolean {
  return ZA_NAMES.has((country ?? "").trim().toLowerCase());
}

/** SARS VAT registration numbers are 10 digits starting with 4. */
export function normalizeZaVatNumber(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/[\s-]/g, "");
  return /^4\d{9}$/.test(digits) ? digits : null;
}

export type DocumentKind = "invoice" | "quote" | "receipt" | "credit_note" | "debit_note";

/** The document heading: only VAT vendors' invoices are tax invoices. */
export function documentHeading(type: DocumentKind, vatRegistered: boolean): string {
  switch (type) {
    case "invoice":
      return vatRegistered ? "TAX INVOICE" : "INVOICE";
    case "quote":
      return "QUOTE";
    case "receipt":
      return "RECEIPT";
    // s21(3): the words "credit note" / "debit note".
    case "credit_note":
      return "CREDIT NOTE";
    case "debit_note":
      return "DEBIT NOTE";
  }
}

export interface TaxInvoiceParty {
  name?: string | null;
  /** Address lines (street, city, postal code…); empty when unknown. */
  address: string[];
  vatNumber?: string | null;
  country?: string | null;
}

export interface TaxInvoiceInput {
  type: DocumentKind;
  currency: string;
  total: number;
  taxTotal: number;
  lines: { description: string; taxRate: number }[];
  supplier: TaxInvoiceParty & { vatRegistered: boolean };
  recipient: TaxInvoiceParty | null;
}

export type TaxInvoiceProblemCode =
  | "not_vat_registered_but_charges_vat"
  | "supplier_vat_number"
  | "supplier_address"
  | "currency_not_zar"
  | "recipient_details"
  | "recipient_vat_number"
  | "line_description";

export interface TaxInvoiceProblem {
  code: TaxInvoiceProblemCode;
  message: string;
  /** Where the owner fixes it. */
  fix: "settings" | "client" | "document";
}

/**
 * What stops this invoice from being a valid SA tax invoice (empty when fine,
 * or when the rules don't apply: non-SA businesses, quotes and receipts).
 */
export function taxInvoiceProblems(input: TaxInvoiceInput): TaxInvoiceProblem[] {
  const { supplier, recipient } = input;
  if (input.type !== "invoice" || !isSouthAfrica(supplier.country)) return [];

  const problems: TaxInvoiceProblem[] = [];

  if (!supplier.vatRegistered) {
    if (input.taxTotal > 0) {
      problems.push({
        code: "not_vat_registered_but_charges_vat",
        message: "Only VAT-registered businesses may charge VAT. Set the VAT rate to 0%, or turn on VAT registration in Settings.",
        fix: "settings",
      });
    }
    return problems;
  }

  if (!normalizeZaVatNumber(supplier.vatNumber)) {
    problems.push({
      code: "supplier_vat_number",
      message: "Add your VAT registration number (10 digits starting with 4) in Settings.",
      fix: "settings",
    });
  }
  if (supplier.address.length === 0) {
    problems.push({ code: "supplier_address", message: "Add your business address in Settings.", fix: "settings" });
  }

  const zeroRatedOnly = input.lines.every((l) => l.taxRate === 0);
  if (input.currency !== "ZAR" && !zeroRatedOnly) {
    problems.push({
      code: "currency_not_zar",
      message: "Tax invoices must be in rand (ZAR). Only zero-rated (0% VAT) export invoices may use another currency.",
      fix: "document",
    });
  }

  // A full tax invoice is needed above R5 000, and for zero-rated supplies in
  // any currency (they can't use the abridged format).
  const needsRecipient = input.total > ZA_FULL_INVOICE_THRESHOLD || input.currency !== "ZAR";
  if (needsRecipient && (!recipient?.name?.trim() || recipient.address.length === 0)) {
    problems.push({
      code: "recipient_details",
      message:
        input.currency !== "ZAR"
          ? "This invoice must show the client's name and address."
          : "Invoices over R 5 000 must show the client's name and address.",
      fix: "client",
    });
  }
  if (recipient?.vatNumber?.trim() && !normalizeZaVatNumber(recipient.vatNumber) && isSouthAfricanVatFormatExpected(recipient)) {
    problems.push({
      code: "recipient_vat_number",
      message: "The client's VAT number doesn't look right (10 digits starting with 4).",
      fix: "client",
    });
  }

  if (input.lines.some((l) => !l.description.trim())) {
    problems.push({ code: "line_description", message: "Every line needs a description of the goods or services.", fix: "document" });
  }

  return problems;
}

/** Foreign clients may have non-SA tax numbers; only check SA-looking ones. */
function isSouthAfricanVatFormatExpected(recipient: TaxInvoiceParty): boolean {
  return !recipient.country?.trim() || isSouthAfrica(recipient.country);
}
