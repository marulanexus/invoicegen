import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { pushDevices } from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { fail, invalid, ok, type ServiceResult } from "@/server/service-result";
import { isExpoPushToken } from "@/server/notifications/push";

const deviceSchema = z.object({
  token: z.string().trim().max(200).refine(isExpoPushToken, "Not an Expo push token"),
  platform: z.enum(["ios", "android"]),
});

/**
 * Register this phone for the signed-in member. A token that was registered
 * by someone else (phone handed over, or signed into another business) moves
 * to the current member, so pushes never reach the previous owner's data.
 */
export async function registerDeviceForOrg(ctx: OrgContext, raw: unknown): Promise<ServiceResult<{ registered: true }>> {
  const parsed = deviceSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { token, platform } = parsed.data;

  const owner = { orgId: ctx.org.id, memberId: ctx.member.id, platform, lastSeenAt: new Date() };
  await db
    .insert(pushDevices)
    .values({ token, ...owner })
    .onConflictDoUpdate({ target: pushDevices.token, set: owner });
  return ok({ registered: true });
}

/** Stop pushes to this phone (called on sign-out). Only the owner can remove it. */
export async function unregisterDeviceForOrg(ctx: OrgContext, raw: unknown): Promise<ServiceResult<{ removed: boolean }>> {
  const parsed = deviceSchema.pick({ token: true }).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);

  const removed = await db
    .delete(pushDevices)
    .where(and(eq(pushDevices.token, parsed.data.token), eq(pushDevices.memberId, ctx.member.id)))
    .returning({ id: pushDevices.id });
  if (removed.length === 0) return fail("not_found", "Device not registered.");
  return ok({ removed: true });
}
