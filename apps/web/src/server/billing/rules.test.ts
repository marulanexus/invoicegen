import { describe, expect, it } from "vitest";

import { payfastApiSignature, payfastSignature, payfastTimestamp, signedPayfastForm } from "@/server/gateways/payfast";
import { isLapsed, periodEndAfter, subscriptionFields, vatIncluded } from "./rules";

const base = {
  merchantId: "10000100",
  merchantKey: "46f0cd694581a",
  returnUrl: "https://app.example.com/settings/billing?status=success",
  cancelUrl: "https://app.example.com/settings/billing?status=cancelled",
  notifyUrl: "https://app.example.com/api/webhooks/payfast-billing",
  email: "owner@example.com",
  paymentId: "8d2f0a9e-0000-4000-8000-000000000001",
  orgId: "70a8f22c-7d6c-4e20-a2f8-c1f100bfbb66",
};

describe("subscriptionFields", () => {
  it("sets up a monthly subscription at the plan's rand price, indefinitely", () => {
    const f = Object.fromEntries(subscriptionFields({ ...base, plan: "growth", interval: "monthly" }));
    expect(f.amount).toBe("149.00");
    expect(f.recurring_amount).toBe("149.00");
    expect(f.subscription_type).toBe("1");
    expect(f.frequency).toBe("3");
    expect(f.cycles).toBe("0");
    expect([f.custom_str1, f.custom_str2, f.custom_str3]).toEqual([base.orgId, "growth", "monthly"]);
  });

  it("bills yearly at 10 months' price with PayFast's annual frequency", () => {
    const f = Object.fromEntries(subscriptionFields({ ...base, plan: "business", interval: "yearly" }));
    expect(f.amount).toBe("2990.00");
    expect(f.frequency).toBe("6");
  });

  it("keeps PayFast's documented field order (the form signature depends on it)", () => {
    const keys = subscriptionFields({ ...base, plan: "growth", interval: "monthly" }).map(([k]) => k);
    const order = ["merchant_id", "notify_url", "email_address", "m_payment_id", "amount", "item_name", "custom_str1", "subscription_type", "frequency", "cycles"];
    const positions = order.map((k) => keys.indexOf(k));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("signs the posted fields with the passphrase", () => {
    const form = signedPayfastForm("test", subscriptionFields({ ...base, name: "", plan: "growth", interval: "monthly" }), "salt");
    const unsigned = form.fields.slice(0, -1);
    expect(unsigned.some(([k]) => k === "name_first")).toBe(false); // blanks left out
    expect(form.fields.at(-1)).toEqual(["signature", payfastSignature(unsigned, "salt")]);
    expect(form.action).toBe("https://sandbox.payfast.co.za/eng/process");
  });
});

describe("payfastApiSignature", () => {
  it("sorts variables and the passphrase alphabetically before hashing", () => {
    const a = payfastApiSignature({ version: "v1", "merchant-id": "10000100", timestamp: "2026-09-27T12:00:01+02:00" }, "salt");
    const b = payfastApiSignature({ timestamp: "2026-09-27T12:00:01+02:00", "merchant-id": "10000100", version: "v1" }, "salt");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(payfastApiSignature({ version: "v1" }, "other")).not.toBe(payfastApiSignature({ version: "v1" }, "salt"));
  });

  it("formats the timestamp in South African time", () => {
    expect(payfastTimestamp(new Date("2026-09-27T10:00:01Z"))).toBe("2026-09-27T12:00:01+02:00");
  });
});

describe("periodEndAfter", () => {
  it("adds a month or a year", () => {
    const paid = new Date("2026-01-31T10:00:00Z");
    expect(periodEndAfter(paid, "monthly").toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(periodEndAfter(paid, "yearly").toISOString().slice(0, 10)).toBe("2027-01-31");
  });
});

describe("vatIncluded", () => {
  it("is zero while not VAT-registered", () => {
    expect(vatIncluded(149, false)).toBe(0);
  });

  it("is the 15% inside a VAT-inclusive price once registered", () => {
    expect(vatIncluded(149, true)).toBe(19.43);
    expect(vatIncluded(115, true)).toBe(15);
  });
});

describe("isLapsed", () => {
  const sub = { provider: "payfast", plan: "growth", currentPeriodEnd: new Date("2026-10-27T00:00:00Z") };

  it("keeps the plan through the period and the grace days", () => {
    expect(isLapsed(sub, new Date("2026-10-29T00:00:00Z"))).toBe(false);
  });

  it("lapses once the grace days are over", () => {
    expect(isLapsed(sub, new Date("2026-10-31T00:00:00Z"))).toBe(true);
  });

  it("leaves free plans and Stripe subscriptions alone", () => {
    expect(isLapsed({ ...sub, plan: "free" }, new Date("2027-01-01"))).toBe(false);
    expect(isLapsed({ ...sub, provider: "stripe" }, new Date("2027-01-01"))).toBe(false);
  });
});
