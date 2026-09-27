import { describe, it, expect } from "vitest";
import { getPlan, isUnlimited, PLAN_ORDER, PLANS, zarPrice } from "./plans";

describe("getPlan", () => {
  it("returns the matching plan for a known id", () => {
    expect(getPlan("free").id).toBe("free");
    expect(getPlan("growth").id).toBe("growth");
    expect(getPlan("business").id).toBe("business");
  });

  it("falls back to the free plan for unknown, null or undefined ids", () => {
    expect(getPlan("enterprise").id).toBe("free");
    expect(getPlan(null).id).toBe("free");
    expect(getPlan(undefined).id).toBe("free");
  });
});

describe("isUnlimited", () => {
  it("treats -1 as unlimited", () => {
    expect(isUnlimited(-1)).toBe(true);
  });

  it("treats any other number as a real limit", () => {
    expect(isUnlimited(3)).toBe(false);
    expect(isUnlimited(0)).toBe(false);
  });
});

describe("free plan limits", () => {
  it("allows 3 clients and 5 documents per month on a single seat", () => {
    expect(PLANS.free.limits.maxClients).toBe(3);
    expect(PLANS.free.limits.maxDocumentsPerMonth).toBe(5);
    expect(PLANS.free.limits.maxSeats).toBe(1);
  });
});

describe("paid plan limits", () => {
  it("marks growth and business clients and documents as unlimited", () => {
    expect(isUnlimited(PLANS.growth.limits.maxClients)).toBe(true);
    expect(isUnlimited(PLANS.growth.limits.maxDocumentsPerMonth)).toBe(true);
    expect(isUnlimited(PLANS.business.limits.maxClients)).toBe(true);
    expect(isUnlimited(PLANS.business.limits.maxDocumentsPerMonth)).toBe(true);
  });
});

describe("PLAN_ORDER", () => {
  it("lists tiers from cheapest to most capable", () => {
    expect(PLAN_ORDER).toEqual(["free", "growth", "business"]);
  });
});

describe("zarPrice", () => {
  it("charges R149 / R299 a month", () => {
    expect(zarPrice("growth", "monthly")).toBe(149);
    expect(zarPrice("business", "monthly")).toBe(299);
  });

  it("gives two months free on yearly billing", () => {
    expect(zarPrice("growth", "yearly")).toBe(149 * 10);
    expect(zarPrice("business", "yearly")).toBe(299 * 10);
  });

  it("has nothing to charge on the free plan", () => {
    expect(zarPrice("free", "monthly")).toBeNull();
  });
});
