import { describe, it, expect } from "vitest";
import { amountOwed, calcLine, calcDocumentTotals, balanceDue, effectiveTotal } from "./calc";

describe("calcLine", () => {
  it("computes a simple line with no discount or tax", () => {
    const r = calcLine({ quantity: 2, unitPrice: 10 });
    expect(r.gross).toBe(20);
    expect(r.discount).toBe(0);
    expect(r.net).toBe(20);
    expect(r.tax).toBe(0);
  });

  it("applies a percentage discount", () => {
    const r = calcLine({ quantity: 1, unitPrice: 100, discountRate: 10 });
    expect(r.gross).toBe(100);
    expect(r.discount).toBe(10);
    expect(r.net).toBe(90);
    expect(r.tax).toBe(0);
  });

  it("applies tax on the net amount", () => {
    const r = calcLine({ quantity: 1, unitPrice: 100, taxRate: 8.5 });
    expect(r.net).toBe(100);
    expect(r.tax).toBe(8.5);
  });

  it("rounds combined discount and tax correctly", () => {
    // gross 100, 10% discount -> net 90, 8.5% tax -> 7.65
    const r = calcLine({
      quantity: 1,
      unitPrice: 100,
      discountRate: 10,
      taxRate: 8.5,
    });
    expect(r.gross).toBe(100);
    expect(r.discount).toBe(10);
    expect(r.net).toBe(90);
    expect(r.tax).toBe(7.65);
  });

  it("rounds a tax that would otherwise drift in floating point", () => {
    // net 99.99 * 7% = 6.9993 -> round2 -> 7.00
    const r = calcLine({ quantity: 1, unitPrice: 99.99, taxRate: 7 });
    expect(r.net).toBe(99.99);
    expect(r.tax).toBe(7);
  });

  it("coerces string inputs to numbers", () => {
    const r = calcLine({ quantity: "3", unitPrice: "2.5" });
    expect(r.gross).toBe(7.5);
    expect(r.net).toBe(7.5);
  });
});

describe("calcDocumentTotals", () => {
  it("sums net, discount, tax and total across multiple lines", () => {
    const totals = calcDocumentTotals([
      { quantity: 2, unitPrice: 10 }, // net 20
      { quantity: 1, unitPrice: 100, discountRate: 10, taxRate: 8.5 }, // net 90, disc 10, tax 7.65
    ]);
    expect(totals.subtotal).toBe(110);
    expect(totals.discountTotal).toBe(10);
    expect(totals.taxTotal).toBe(7.65);
    expect(totals.total).toBe(117.65);
  });

  it("returns zeroed totals for an empty document", () => {
    const totals = calcDocumentTotals([]);
    expect(totals).toEqual({
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
    });
  });

  it("derives embedded tax out of the total in tax-inclusive mode", () => {
    // One line: net 100, tax 10. Inclusive => total stays 100, subtotal = 100 - 10.
    const totals = calcDocumentTotals(
      [{ quantity: 1, unitPrice: 100, taxRate: 10 }],
      true
    );
    expect(totals.total).toBe(100);
    expect(totals.taxTotal).toBe(10);
    expect(totals.subtotal).toBe(90);
    // Documented invariant: subtotal = total - taxTotal.
    expect(totals.subtotal).toBe(totals.total - totals.taxTotal);
  });

  it("adds tax on top in the default (exclusive) mode", () => {
    const totals = calcDocumentTotals(
      [{ quantity: 1, unitPrice: 100, taxRate: 10 }],
      false
    );
    expect(totals.subtotal).toBe(100);
    expect(totals.taxTotal).toBe(10);
    expect(totals.total).toBe(110);
  });

  it("sums fractional cents exactly via round2 (no float drift)", () => {
    // Three lines of 0.10 each -> 0.30 exactly, not 0.30000000000000004.
    const totals = calcDocumentTotals([
      { quantity: 1, unitPrice: 0.1 },
      { quantity: 1, unitPrice: 0.1 },
      { quantity: 1, unitPrice: 0.1 },
    ]);
    expect(totals.subtotal).toBe(0.3);
    expect(totals.total).toBe(0.3);
  });
});

describe("balanceDue", () => {
  it("subtracts amount paid from the total", () => {
    expect(balanceDue(117.65, 100)).toBe(17.65);
  });

  it("returns 0 when fully paid", () => {
    expect(balanceDue(50, 50)).toBe(0);
  });

  it("coerces string inputs", () => {
    expect(balanceDue("100.00", "25.50")).toBe(74.5);
  });

  it("can go negative when overpaid", () => {
    expect(balanceDue(10, 25)).toBe(-15);
  });
});

describe("effectiveTotal / amountOwed", () => {
  it("applies credit and debit notes to what's owed", () => {
    expect(effectiveTotal({ total: "1150.00", adjustmentTotal: "-230.00" })).toBe(920);
    expect(amountOwed({ total: "1150.00", amountPaid: "500.00", adjustmentTotal: "-230.00" })).toBe(420);
    expect(amountOwed({ total: "1150.00", amountPaid: "0", adjustmentTotal: "115.00" })).toBe(1265);
  });

  it("treats a missing adjustment as zero and never goes negative", () => {
    expect(amountOwed({ total: "100", amountPaid: "40" })).toBe(60);
    expect(amountOwed({ total: "100", amountPaid: "100", adjustmentTotal: "-50" })).toBe(0);
  });
});
