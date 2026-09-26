import { describe, it, expect } from "vitest";
import {
  toNumber,
  round2,
  toMoneyString,
  formatCurrency,
  SUPPORTED_CURRENCIES,
} from "./money";

describe("toNumber", () => {
  it("treats null, undefined and empty string as 0", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("")).toBe(0);
  });

  it("parses numeric strings", () => {
    expect(toNumber("12.5")).toBe(12.5);
  });

  it("passes numbers through", () => {
    expect(toNumber(42)).toBe(42);
  });

  it("falls back to 0 for non-finite or invalid values", () => {
    expect(toNumber("abc")).toBe(0);
    expect(toNumber(Number.NaN)).toBe(0);
    expect(toNumber(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("round2", () => {
  it("rounds 0.1 + 0.2 to 0.3", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("rounds to two decimals", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.345)).toBe(2.35);
  });
});

describe("toMoneyString", () => {
  it("returns a fixed 2-decimal string", () => {
    expect(toMoneyString(10)).toBe("10.00");
    expect(toMoneyString(1.5)).toBe("1.50");
    expect(toMoneyString(0.1 + 0.2)).toBe("0.30");
  });
});

describe("formatCurrency", () => {
  it("formats USD with grouped thousands", () => {
    const out = formatCurrency(1250, "USD");
    expect(out).toContain("1,250");
  });

  it("defaults to USD when no currency is given", () => {
    const out = formatCurrency(1250);
    expect(out).toContain("1,250");
  });

  it("falls back to a code-prefixed plain number for malformed currency codes", () => {
    // A malformed (non 3-letter) code makes Intl throw, exercising the fallback.
    expect(formatCurrency(10, "INVALID")).toBe("INVALID 10.00");
  });

  it("formats well-formed but unsupported codes via Intl without throwing", () => {
    // Intl accepts any 3-letter code (uses a non-breaking space separator).
    const out = formatCurrency(10, "XYZ");
    expect(out).toContain("XYZ");
    expect(out.replace(/ /g, " ")).toBe("XYZ 10.00");
  });
});

describe("SUPPORTED_CURRENCIES", () => {
  it("includes USD, EUR, GBP and ZAR", () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(codes).toContain("USD");
    expect(codes).toContain("EUR");
    expect(codes).toContain("GBP");
    expect(codes).toContain("ZAR");
  });
});
