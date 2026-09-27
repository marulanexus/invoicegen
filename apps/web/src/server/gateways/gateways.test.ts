import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  amountMatches,
  buildPayfastForm,
  ipInCidr,
  itnParamString,
  parseItn,
  payfastSignature,
  phpUrlEncode,
  verifyItnSignature,
} from "./payfast";
import { verifyYocoWebhook } from "./yoco";

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

describe("phpUrlEncode", () => {
  it("matches PHP urlencode (spaces as +, upper-case hex, ~!*'() encoded)", () => {
    expect(phpUrlEncode("Invoice INV-0001")).toBe("Invoice+INV-0001");
    expect(phpUrlEncode("https://x.co/p/a?payment=returned")).toBe(
      "https%3A%2F%2Fx.co%2Fp%2Fa%3Fpayment%3Dreturned"
    );
    expect(phpUrlEncode("~!*'()")).toBe("%7E%21%2A%27%28%29");
    expect(phpUrlEncode("a_b.c-d")).toBe("a_b.c-d");
  });
});

describe("payfastSignature / buildPayfastForm", () => {
  it("signs non-blank fields in order with the passphrase appended", () => {
    const expected = md5(
      "merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Invoice+INV-0001&passphrase=jt7NOE43FZPn"
    );
    expect(
      payfastSignature(
        [
          ["merchant_id", "10000100"],
          ["merchant_key", "46f0cd694581a"],
          ["name_first", ""],
          ["amount", "100.00"],
          ["item_name", " Invoice INV-0001 "],
        ],
        "jt7NOE43FZPn"
      )
    ).toBe(expected);
  });

  it("posts exactly the signed fields, in PayFast's order, signature last", () => {
    const form = buildPayfastForm({
      merchantId: "10000100",
      merchantKey: "46f0cd694581a",
      passphrase: "jt7NOE43FZPn",
      mode: "test",
      returnUrl: "https://app.test/p/t?payment=returned",
      cancelUrl: "https://app.test/p/t?payment=cancelled",
      notifyUrl: "https://app.test/api/webhooks/payfast",
      paymentId: "6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f",
      amount: "1150.00",
      itemName: "Invoice INV-0007",
      email: null,
    });
    expect(form.action).toBe("https://sandbox.payfast.co.za/eng/process");
    expect(form.fields.map(([k]) => k)).toEqual([
      "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
      "m_payment_id", "amount", "item_name", "signature",
    ]);
    const unsigned = form.fields.slice(0, -1);
    expect(form.fields.at(-1)?.[1]).toBe(payfastSignature(unsigned, "jt7NOE43FZPn"));
  });
});

describe("PayFast ITN", () => {
  // As PayFast posts it: empty fields included, signature after the data fields.
  const data =
    "m_payment_id=6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f&pf_payment_id=1089250&payment_status=COMPLETE" +
    "&item_name=Invoice+INV-0007&item_description=&amount_gross=1150.00&amount_fee=-26.45" +
    "&amount_net=1123.55&custom_str1=&name_first=Test&name_last=Buyer&email_address=sbtu01%40payfast.io" +
    "&merchant_id=10000100";
  const signed = (passphrase?: string) =>
    `${data}&signature=${md5(passphrase ? `${data}&passphrase=${passphrase}` : data)}`;

  it("parses fields in order, decoding + and %XX", () => {
    const fields = parseItn(signed());
    expect(fields[0]).toEqual(["m_payment_id", "6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f"]);
    expect(Object.fromEntries(fields).item_name).toBe("Invoice INV-0007");
    expect(Object.fromEntries(fields).email_address).toBe("sbtu01@payfast.io");
    expect(itnParamString(fields)).toBe(data);
  });

  it("accepts a correctly signed ITN, with or without a passphrase", () => {
    expect(verifyItnSignature(parseItn(signed()), undefined)).toBe(true);
    expect(verifyItnSignature(parseItn(signed("jt7NOE43FZPn")), "jt7NOE43FZPn")).toBe(true);
  });

  it("rejects tampering, a wrong passphrase or a missing signature", () => {
    const tampered = signed().replace("amount_gross=1150.00", "amount_gross=1.00");
    expect(verifyItnSignature(parseItn(tampered), undefined)).toBe(false);
    expect(verifyItnSignature(parseItn(signed("jt7NOE43FZPn")), "wrong")).toBe(false);
    expect(verifyItnSignature(parseItn(data), undefined)).toBe(false);
  });

  it("checks the amount to the cent", () => {
    expect(amountMatches("1150.00", "1150.00")).toBe(true);
    expect(amountMatches("1150.00", "1150.01")).toBe(true);
    expect(amountMatches("1150.00", "1149.90")).toBe(false);
    expect(amountMatches("1150.00", undefined)).toBe(false);
  });

  it("matches PayFast's published IP ranges only", () => {
    expect(ipInCidr("197.97.145.150", "197.97.145.144/28")).toBe(true);
    expect(ipInCidr("197.97.145.160", "197.97.145.144/28")).toBe(false);
    expect(ipInCidr("::ffff:41.74.179.200", "41.74.179.192/27")).toBe(true);
    expect(ipInCidr("144.126.193.139", "144.126.193.139/32")).toBe(true);
    expect(ipInCidr("not-an-ip", "41.74.179.192/27")).toBe(false);
  });
});

describe("verifyYocoWebhook", () => {
  const secretBytes = crypto.randomBytes(24);
  const secret = `whsec_${secretBytes.toString("base64")}`;
  const body = JSON.stringify({ type: "payment.succeeded", payload: { id: "p_1", amount: 115000 } });
  const now = 1_790_000_000_000;
  const ts = String(now / 1000);
  // Exactly as Yoco's docs build it.
  const sig = crypto.createHmac("sha256", secretBytes).update(`msg_1.${ts}.${body}`).digest("base64");

  it("accepts Yoco's signature format, including a list of signatures", () => {
    expect(verifyYocoWebhook({ id: "msg_1", timestamp: ts, signature: `v1,${sig}` }, body, secret, now)).toBe(true);
    expect(
      verifyYocoWebhook({ id: "msg_1", timestamp: ts, signature: `v1,bm9wZQ== v1,${sig}` }, body, secret, now)
    ).toBe(true);
  });

  it("rejects a changed body, wrong id, wrong secret or missing headers", () => {
    const h = { id: "msg_1", timestamp: ts, signature: `v1,${sig}` };
    expect(verifyYocoWebhook(h, body.replace("115000", "1"), secret, now)).toBe(false);
    expect(verifyYocoWebhook({ ...h, id: "msg_2" }, body, secret, now)).toBe(false);
    expect(verifyYocoWebhook(h, body, `whsec_${crypto.randomBytes(24).toString("base64")}`, now)).toBe(false);
    expect(verifyYocoWebhook({ ...h, signature: null }, body, secret, now)).toBe(false);
  });

  it("rejects replays outside the 3-minute window", () => {
    const h = { id: "msg_1", timestamp: ts, signature: `v1,${sig}` };
    expect(verifyYocoWebhook(h, body, secret, now + 170_000)).toBe(true);
    expect(verifyYocoWebhook(h, body, secret, now + 190_000)).toBe(false);
  });
});
