import { describe, expect, it } from "vitest";

import { shareMessage, whatsappNumber, whatsappUrl } from "./whatsapp";

describe("whatsappNumber", () => {
  it("turns South African local numbers into international format", () => {
    expect(whatsappNumber("076 616 8037")).toBe("27766168037");
    expect(whatsappNumber("+27 76 616 8037")).toBe("27766168037");
    expect(whatsappNumber("(082) 123-4567")).toBe("27821234567");
  });

  it("keeps other international numbers and rejects junk", () => {
    expect(whatsappNumber("+254 712 345 678")).toBe("254712345678");
    expect(whatsappNumber("12345")).toBeNull();
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
  });
});

describe("whatsappUrl", () => {
  it("opens the client's chat, or lets the owner pick one", () => {
    expect(whatsappUrl("Hi & bye", "0766168037")).toBe("https://wa.me/27766168037?text=Hi%20%26%20bye");
    expect(whatsappUrl("Hi", null)).toBe("https://wa.me/?text=Hi");
  });
});

describe("shareMessage", () => {
  const base = { number: "INV-0007", total: "R 1 150,00", url: "https://app.test/p/abc" };

  it("asks to pay for invoices and mentions the due date", () => {
    expect(shareMessage({ ...base, type: "invoice", businessName: "Marula Nexus", clientName: "Thandi", dueDate: "11 Oct 2026" })).toBe(
      "Hi Thandi,\nhere is invoice INV-0007 from Marula Nexus for R 1 150,00, due 11 Oct 2026.\nView and pay here: https://app.test/p/abc"
    );
  });

  it("just links other documents", () => {
    expect(shareMessage({ ...base, type: "credit_note", number: "CN-0001", dueDate: "11 Oct 2026" })).toBe(
      "Hi,\nhere is credit note CN-0001 for R 1 150,00.\nView it here: https://app.test/p/abc"
    );
  });
});
