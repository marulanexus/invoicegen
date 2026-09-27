import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { pushDevices } from "@/server/db/schema";
import { env } from "@/lib/env";

/**
 * Push notifications to business owners' phones via the Expo push service
 * (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Best effort: a failed push never breaks the action that triggered it.
 */

const SEND_URL = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
const BATCH = 100;

export interface PushNotification {
  title: string;
  body: string;
  /** Delivered to the app; `documentId` opens that document when tapped. */
  data?: { documentId?: string; [key: string]: unknown };
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: "default";
  priority: "high";
  channelId: "default";
}

export type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

/** One message per token, in batches the Expo API accepts. */
export function buildBatches(tokens: string[], n: PushNotification): ExpoMessage[][] {
  const messages = tokens.map<ExpoMessage>((to) => ({
    to,
    title: n.title,
    body: n.body,
    data: n.data,
    sound: "default",
    priority: "high",
    channelId: "default",
  }));
  const batches: ExpoMessage[][] = [];
  for (let i = 0; i < messages.length; i += BATCH) batches.push(messages.slice(i, i + BATCH));
  return batches;
}

/** Tokens Expo says can no longer receive pushes (tickets are in message order). */
export function deadTokens(batch: ExpoMessage[], tickets: ExpoTicket[]): string[] {
  return tickets.flatMap((t, i) =>
    t.status === "error" && t.details?.error === "DeviceNotRegistered" && batch[i] ? [batch[i].to] : []
  );
}

async function sendBatch(batch: ExpoMessage[]): Promise<ExpoTicket[]> {
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(batch),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Expo push failed (${res.status}) ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: ExpoTicket[] };
  return json.data ?? [];
}

/** Notify every signed-in phone of a business. Never throws. */
export async function sendPushToOrg(orgId: string, n: PushNotification): Promise<void> {
  try {
    const devices = await db
      .select({ token: pushDevices.token })
      .from(pushDevices)
      .where(eq(pushDevices.orgId, orgId));
    if (devices.length === 0) return;

    const dead: string[] = [];
    for (const batch of buildBatches(devices.map((d) => d.token), n)) {
      dead.push(...deadTokens(batch, await sendBatch(batch)));
    }
    if (dead.length) await db.delete(pushDevices).where(inArray(pushDevices.token, dead));
  } catch (err) {
    console.error("[push] send failed", err);
  }
}
