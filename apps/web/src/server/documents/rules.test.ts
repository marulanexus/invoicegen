import { describe, expect, it } from "vitest";

import type { BusinessProfile, Document } from "@/server/db/schema";
import { addDays, statusActionBlocked, withProfileDefaults } from "./rules";

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
