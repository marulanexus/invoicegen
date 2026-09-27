import { describe, expect, it } from "vitest";

import type { Document } from "@/server/db/schema";
import { balanceOf, paymentProblem, statusForAmountPaid } from "./rules";

const invoice = (over: Partial<Document> = {}) =>
  ({
    type: "invoice",
    status: "sent",
    total: "1150.00",
    amountPaid: "0.00",
    currency: "ZAR",
    ...over,
  }) as Document;

describe("balanceOf", () => {
  it("is total minus paid, never negative", () => {
    expect(balanceOf(invoice({ amountPaid: "150.00" }))).toBe(1000);
    expect(balanceOf(invoice({ amountPaid: "2000.00" }))).toBe(0);
  });
});

describe("paymentProblem", () => {
  it("accepts part or full payment of the balance", () => {
    expect(paymentProblem(invoice(), 500)).toBeNull();
    expect(paymentProblem(invoice({ amountPaid: "150.00" }), 1000)).toBeNull();
    expect(paymentProblem(invoice({ status: "draft" }), 1150)).toBeNull();
  });

  it("tolerates float noise from clients", () => {
    expect(paymentProblem(invoice(), 1150.004)).toBeNull();
  });

  it("rejects overpayment with the balance in the message", () => {
    const p = paymentProblem(invoice({ amountPaid: "150.00" }), 1000.01);
    expect(p?.code).toBe("validation");
    expect(p?.message).toMatch(/balance due/);
    expect(p?.message).toMatch(/1[\s ,.]?000/);
  });

  it("rejects quotes, receipts, void and fully paid invoices", () => {
    expect(paymentProblem(invoice({ type: "quote" }), 1)?.code).toBe("conflict");
    expect(paymentProblem(invoice({ type: "receipt" }), 1)?.code).toBe("conflict");
    expect(paymentProblem(invoice({ status: "void" }), 1)?.code).toBe("conflict");
    expect(paymentProblem(invoice({ amountPaid: "1150.00", status: "paid" }), 1)?.message).toMatch(/fully paid/);
  });
});

describe("statusForAmountPaid", () => {
  it("moves to partial, then paid", () => {
    expect(statusForAmountPaid(invoice(), 100)).toEqual({ status: "partial", fullyPaid: false });
    expect(statusForAmountPaid(invoice(), 1150)).toEqual({ status: "paid", fullyPaid: true });
  });

  it("keeps the current status when nothing is paid", () => {
    expect(statusForAmountPaid(invoice({ status: "overdue" }), 0).status).toBe("overdue");
  });
});

describe("with credit and debit notes", () => {
  it("owes total + adjustments − paid", () => {
    expect(balanceOf(invoice({ adjustmentTotal: "-150.00" }))).toBe(1000);
    expect(paymentProblem(invoice({ adjustmentTotal: "-150.00" }), 1000.01)?.code).toBe("validation");
    expect(statusForAmountPaid(invoice({ adjustmentTotal: "-150.00" }), 1000)).toEqual({ status: "paid", fullyPaid: true });
    expect(balanceOf(invoice({ adjustmentTotal: "115.00" }))).toBe(1265);
  });
});
