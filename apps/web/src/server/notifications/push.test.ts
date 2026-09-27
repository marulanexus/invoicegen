import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildBatches, deadTokens, isExpoPushToken, type ExpoTicket } from "./push";

const token = (i: number) => `ExponentPushToken[${String(i).padStart(22, "x")}]`;

describe("isExpoPushToken", () => {
  it("accepts Expo tokens only", () => {
    expect(isExpoPushToken("ExponentPushToken[abc123]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abc123]")).toBe(true);
    expect(isExpoPushToken("fcm-raw-token")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
  });
});

describe("buildBatches", () => {
  it("sends one message per phone, at most 100 per request", () => {
    const batches = buildBatches(
      Array.from({ length: 205 }, (_, i) => token(i)),
      { title: "R 1 150,00 received", body: "INV-0007 via PayFast", data: { documentId: "d1" } }
    );
    expect(batches.map((b) => b.length)).toEqual([100, 100, 5]);
    expect(batches[0][0]).toEqual({
      to: token(0),
      title: "R 1 150,00 received",
      body: "INV-0007 via PayFast",
      data: { documentId: "d1" },
      sound: "default",
      priority: "high",
      channelId: "default",
    });
  });
});

describe("deadTokens", () => {
  it("returns only tokens Expo reports as DeviceNotRegistered, matched by position", () => {
    const batch = buildBatches([token(1), token(2), token(3)], { title: "t", body: "b" })[0];
    const tickets: ExpoTicket[] = [
      { status: "ok", id: "r1" },
      { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
      { status: "error", message: "busy", details: { error: "MessageRateExceeded" } },
    ];
    expect(deadTokens(batch, tickets)).toEqual([token(2)]);
  });
});
