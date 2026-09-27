import { describe, expect, it } from "vitest";

import {
  documentHeading,
  isSouthAfrica,
  normalizeZaVatNumber,
  taxInvoiceProblems,
  type TaxInvoiceInput,
} from "./tax-invoice";

const vendor = {
  name: "Marula Nexus (Pty) Ltd",
  address: ["1 Main Rd", "Johannesburg", "2000"],
  vatNumber: "4123456789",
  country: "South Africa",
  vatRegistered: true,
};
const client = { name: "Thandi Mokoena", address: ["5 Oak Ave", "Durban"], vatNumber: null };

function invoice(over: Partial<TaxInvoiceInput> = {}): TaxInvoiceInput {
  return {
    type: "invoice",
    currency: "ZAR",
    total: 1150,
    taxTotal: 150,
    lines: [{ description: "Logo design", taxRate: 15 }],
    supplier: vendor,
    recipient: client,
    ...over,
  };
}
const codes = (i: TaxInvoiceInput) => taxInvoiceProblems(i).map((p) => p.code);

describe("helpers", () => {
  it("recognises South Africa however it was typed", () => {
    expect(["ZA", "za", "South Africa", " RSA ", "Suid-Afrika"].every(isSouthAfrica)).toBe(true);
    expect(isSouthAfrica("Namibia")).toBe(false);
    expect(isSouthAfrica(null)).toBe(false);
  });

  it("accepts SARS VAT numbers: 10 digits starting with 4", () => {
    expect(normalizeZaVatNumber("4123 456 789")).toBe("4123456789");
    expect(normalizeZaVatNumber("412-345-6789")).toBe("4123456789");
    expect(normalizeZaVatNumber("5123456789")).toBeNull();
    expect(normalizeZaVatNumber("412345678")).toBeNull();
  });

  it("only calls a VAT vendor's invoice a tax invoice", () => {
    expect(documentHeading("invoice", true)).toBe("TAX INVOICE");
    expect(documentHeading("invoice", false)).toBe("INVOICE");
    expect(documentHeading("quote", true)).toBe("QUOTE");
    expect(documentHeading("receipt", true)).toBe("RECEIPT");
  });
});

describe("taxInvoiceProblems", () => {
  it("passes a complete tax invoice", () => {
    expect(codes(invoice())).toEqual([]);
  });

  it("doesn't apply outside South Africa or to quotes and receipts", () => {
    expect(codes(invoice({ supplier: { ...vendor, country: "Kenya", vatNumber: null } }))).toEqual([]);
    expect(codes(invoice({ type: "quote", supplier: { ...vendor, vatNumber: null } }))).toEqual([]);
  });

  it("stops non-vendors charging VAT, and nothing else", () => {
    const nonVendor = { ...vendor, vatRegistered: false, vatNumber: null, address: [] };
    expect(codes(invoice({ supplier: nonVendor }))).toEqual(["not_vat_registered_but_charges_vat"]);
    expect(codes(invoice({ supplier: nonVendor, taxTotal: 0, lines: [{ description: "x", taxRate: 0 }] }))).toEqual([]);
  });

  it("requires the vendor's VAT number and address (s20(4)(b))", () => {
    expect(codes(invoice({ supplier: { ...vendor, vatNumber: "12345" } }))).toContain("supplier_vat_number");
    expect(codes(invoice({ supplier: { ...vendor, address: [] } }))).toContain("supplier_address");
  });

  it("requires the client's name and address above R5 000 only (s20(4) vs s20(5))", () => {
    const noClient = { recipient: null };
    expect(codes(invoice({ ...noClient, total: 5000 }))).toEqual([]);
    expect(codes(invoice({ ...noClient, total: 5000.01 }))).toEqual(["recipient_details"]);
    expect(codes(invoice({ total: 9000, recipient: { name: "Thandi", address: [] } }))).toEqual(["recipient_details"]);
  });

  it("requires rand unless every line is zero-rated, and then a full invoice", () => {
    expect(codes(invoice({ currency: "USD" }))).toContain("currency_not_zar");
    const export_ = invoice({ currency: "USD", taxTotal: 0, lines: [{ description: "Consulting", taxRate: 0 }], recipient: null });
    expect(codes(export_)).toEqual(["recipient_details"]);
    expect(codes({ ...export_, recipient: client })).toEqual([]);
  });

  it("checks a South African client's VAT number format, not foreign ones", () => {
    expect(codes(invoice({ recipient: { ...client, vatNumber: "123" } }))).toEqual(["recipient_vat_number"]);
    expect(codes(invoice({ recipient: { ...client, vatNumber: "4987654321" } }))).toEqual([]);
    expect(codes(invoice({ recipient: { ...client, vatNumber: "GB123456789", country: "United Kingdom" } }))).toEqual([]);
  });

  it("requires a description on every line (s20(4)(e))", () => {
    expect(codes(invoice({ lines: [{ description: "  ", taxRate: 15 }] }))).toEqual(["line_description"]);
  });
});
