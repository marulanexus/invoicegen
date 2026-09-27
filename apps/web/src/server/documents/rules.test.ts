import { describe, expect, it } from "vitest";

import type { BusinessProfile, Document } from "@/server/db/schema";
import {
  addDays,
  buildNote,
  isLockedTaxInvoice,
  lockReason,
  statusActionBlocked,
  statusAfterAdjustment,
  withProfileDefaults,
  type NoteRequest,
} from "./rules";

const profile = {
  defaultCurrency: "ZAR",
  paymentTermsDays: 30,
  defaultTemplateKey: "modern",
  brandColor: "#0f766e",
  taxLabel: "VAT",
  taxInclusive: false,
  defaultTaxRate: "15.00",
  defaultNotes: "Thank you for your business",
  defaultTerms: "Payment due within 30 days",
} as unknown as BusinessProfile;

const today = new Date("2026-09-27T10:00:00Z");

describe("withProfileDefaults", () => {
  it("fills a minimal phone payload from the business profile", () => {
    const out = withProfileDefaults(
      { type: "invoice", clientId: null, lineItems: [{ description: "Logo design", unitPrice: 1500 }] },
      profile,
      today
    ) as Record<string, unknown>;

    expect(out).toMatchObject({
      currency: "ZAR",
      issueDate: "2026-09-27",
      dueDate: "2026-10-27",
      templateKey: "modern",
      accentColor: "#0f766e",
      taxLabel: "VAT",
      taxInclusive: false,
      notes: "Thank you for your business",
      terms: "Payment due within 30 days",
    });
    expect(out.lineItems).toEqual([{ description: "Logo design", unitPrice: 1500, taxRate: 15 }]);
  });

  it("never overrides values the caller sent, including explicit zero tax", () => {
    const out = withProfileDefaults(
      {
        type: "invoice",
        currency: "USD",
        issueDate: "2026-01-10",
        dueDate: null,
        notes: "",
        lineItems: [{ description: "Export work", unitPrice: 100, taxRate: 0 }],
      },
      profile,
      today
    ) as Record<string, unknown>;

    expect(out.currency).toBe("USD");
    expect(out.issueDate).toBe("2026-01-10");
    expect(out.dueDate).toBeNull();
    expect(out.notes).toBe("");
    expect(out.lineItems).toEqual([{ description: "Export work", unitPrice: 100, taxRate: 0 }]);
  });

  it("only derives a due date for invoices", () => {
    const quote = withProfileDefaults({ type: "quote", lineItems: [] }, profile, today) as Record<string, unknown>;
    expect(quote.dueDate).toBeUndefined();
  });

  it("leaves non-object input for the validator to reject", () => {
    expect(withProfileDefaults("nope", profile)).toBe("nope");
    expect(withProfileDefaults(null, profile)).toBeNull();
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-12-20", 14)).toBe("2027-01-03");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("statusActionBlocked", () => {
  const doc = (type: Document["type"], status: Document["status"]) => ({ type, status }) as Document;

  it("allows the transitions the web menu offers", () => {
    expect(statusActionBlocked(doc("invoice", "draft"), "send")).toBeNull();
    expect(statusActionBlocked(doc("invoice", "sent"), "mark_paid")).toBeNull();
    expect(statusActionBlocked(doc("receipt", "draft"), "mark_paid")).toBeNull();
    expect(statusActionBlocked(doc("quote", "sent"), "accept")).toBeNull();
    expect(statusActionBlocked(doc("invoice", "paid"), "reopen")).toBeNull();
    expect(statusActionBlocked(doc("invoice", "sent"), "void")).toBeNull();
  });

  it("blocks transitions that make no sense", () => {
    expect(statusActionBlocked(doc("invoice", "sent"), "send")).toMatch(/drafts/);
    expect(statusActionBlocked(doc("quote", "sent"), "mark_paid")).toMatch(/Quotes/);
    expect(statusActionBlocked(doc("invoice", "void"), "mark_paid")).toMatch(/void/);
    expect(statusActionBlocked(doc("invoice", "sent"), "accept")).toMatch(/Only quotes/);
    expect(statusActionBlocked(doc("invoice", "draft"), "reopen")).toMatch(/already a draft/);
    expect(statusActionBlocked(doc("invoice", "void"), "void")).toMatch(/already void/);
  });
});

describe("credit and debit notes", () => {
  const za = { vatRegistered: true, country: "South Africa" };
  const inv = (over: Partial<Document> = {}) =>
    ({
      type: "invoice",
      status: "sent",
      number: "INV-0007",
      total: "1150.00",
      adjustmentTotal: "0.00",
      amountPaid: "0.00",
      taxInclusive: false,
      fromSnapshot: za,
      ...over,
    }) as Document;
  const items = [{ description: "Logo design", quantity: "1", unitPrice: "1000.00", discountRate: "0", taxRate: "15" }];
  const req = (over: Partial<NoteRequest> = {}): NoteRequest => ({ kind: "credit", reason: "Agreed discount", mode: "amount", ...over });

  it("locks issued SA tax invoices and all notes, nothing else", () => {
    expect(isLockedTaxInvoice(inv())).toBe(true);
    expect(isLockedTaxInvoice(inv({ status: "draft" }))).toBe(false);
    expect(isLockedTaxInvoice(inv({ fromSnapshot: { vatRegistered: false, country: "South Africa" } }))).toBe(false);
    expect(isLockedTaxInvoice(inv({ fromSnapshot: { vatRegistered: true, country: "Kenya" } }))).toBe(false);
    expect(lockReason(inv(), "edit")).toMatch(/credit note or debit note/);
    expect(lockReason(inv(), "void")).toMatch(/credit note for the full amount/);
    expect(lockReason(inv(), "status")).toBeNull();
    expect(lockReason(inv({ type: "credit_note" }), "status")).toMatch(/can't be changed/);
    expect(lockReason(inv({ status: "draft" }), "edit")).toBeNull();
  });

  it("builds a full credit that mirrors an untouched invoice", () => {
    const r = buildNote(inv(), items, req({ mode: "full" }));
    expect(r).toEqual({ ok: true, taxInclusive: false, lines: [{ description: "Logo design", quantity: 1, unitPrice: 1000, discountRate: 0, taxRate: 15 }] });
  });

  it("credits what's left after earlier notes, as a VAT-inclusive line", () => {
    const r = buildNote(inv({ adjustmentTotal: "-150.00" }), items, req({ mode: "full" }));
    expect(r).toMatchObject({ ok: true, taxInclusive: true, lines: [{ unitPrice: 1000, taxRate: 15 }] });
  });

  it("makes an amount note VAT-inclusive at the invoice's rate", () => {
    const r = buildNote(inv(), items, req({ amount: 230, description: "Discount" }));
    expect(r).toEqual({ ok: true, taxInclusive: true, lines: [{ description: "Discount", quantity: 1, unitPrice: 230, discountRate: 0, taxRate: 15 }] });
  });

  it("refuses notes that can't apply", () => {
    expect(buildNote(inv({ status: "draft" }), items, req({ amount: 1 }))).toMatchObject({ ok: false, error: /hasn't been issued/ });
    expect(buildNote(inv({ status: "void" }), items, req({ amount: 1 }))).toMatchObject({ ok: false, error: /already cancelled/ });
    expect(buildNote(inv({ type: "quote" }), items, req({ amount: 1 }))).toMatchObject({ ok: false });
    expect(buildNote(inv(), items, req({ amount: 1150.01 }))).toMatchObject({ ok: false, error: /at most 1150\.00/ });
    expect(buildNote(inv(), items, req({ kind: "debit", mode: "full" }))).toMatchObject({ ok: false });
    const mixed = [...items, { ...items[0], taxRate: "0" }];
    expect(buildNote(inv(), mixed, req({ amount: 100 }))).toMatchObject({ ok: false, error: /several VAT rates/ });
    expect(buildNote(inv(), mixed, req({ amount: 100, taxRate: 15 }))).toMatchObject({ ok: true });
  });

  it("lets a debit note exceed the invoice total", () => {
    expect(buildNote(inv(), items, req({ kind: "debit", amount: 5000 }))).toMatchObject({ ok: true });
  });

  it("sets the invoice status from what's left and what's paid", () => {
    expect(statusAfterAdjustment(inv(), -1150)).toBe("void");
    expect(statusAfterAdjustment(inv({ amountPaid: "920.00", status: "partial" }), -230)).toBe("paid");
    expect(statusAfterAdjustment(inv({ amountPaid: "500.00", status: "partial" }), -230)).toBe("partial");
    expect(statusAfterAdjustment(inv({ amountPaid: "1150.00", status: "paid" }), 115)).toBe("partial");
    expect(statusAfterAdjustment(inv({ status: "overdue" }), -100)).toBe("overdue");
  });
});
