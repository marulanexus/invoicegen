import "server-only";

import { and, count, eq, gte, sql } from "drizzle-orm";
import { startOfMonth } from "date-fns";

import { db } from "@/server/db";
import { clients, documents, usageCounters } from "@/server/db/schema";
import { isUnlimited, type Plan } from "@/lib/plans";
import type { OrgContext } from "@/server/auth/context";

export interface UsageSnapshot {
  clients: number;
  documentsThisMonth: number;
  maxClients: number;
  maxDocumentsPerMonth: number;
}

export async function getUsage(orgId: string, plan: Plan): Promise<UsageSnapshot> {
  const monthStart = startOfMonth(new Date());

  const [[clientRow], [docRow]] = await Promise.all([
    db
      .select({ value: count() })
      .from(clients)
      .where(eq(clients.orgId, orgId)),
    db
      .select({ value: count() })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          gte(documents.createdAt, monthStart)
        )
      ),
  ]);

  return {
    clients: clientRow?.value ?? 0,
    documentsThisMonth: docRow?.value ?? 0,
    maxClients: plan.limits.maxClients,
    maxDocumentsPerMonth: plan.limits.maxDocumentsPerMonth,
  };
}

export interface LimitCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Free plan caps at 3 clients. Paid plans are unlimited.
 */
export async function canCreateClient(ctx: OrgContext): Promise<LimitCheck> {
  const { maxClients } = ctx.plan.limits;
  if (isUnlimited(maxClients)) return { allowed: true };

  const [row] = await db
    .select({ value: count() })
    .from(clients)
    .where(eq(clients.orgId, ctx.org.id));

  if ((row?.value ?? 0) >= maxClients) {
    return {
      allowed: false,
      reason: `Your ${ctx.plan.name} plan allows up to ${maxClients} clients. Upgrade to add more.`,
    };
  }
  return { allowed: true };
}

/**
 * Free plan caps at 5 documents per calendar month. Paid plans are unlimited.
 */
export async function canCreateDocument(ctx: OrgContext): Promise<LimitCheck> {
  const { maxDocumentsPerMonth } = ctx.plan.limits;
  if (isUnlimited(maxDocumentsPerMonth)) return { allowed: true };

  const monthStart = startOfMonth(new Date());
  const [row] = await db
    .select({ value: count() })
    .from(documents)
    .where(
      and(eq(documents.orgId, ctx.org.id), gte(documents.createdAt, monthStart))
    );

  if ((row?.value ?? 0) >= maxDocumentsPerMonth) {
    return {
      allowed: false,
      reason: `Your ${ctx.plan.name} plan allows ${maxDocumentsPerMonth} documents per month. Upgrade for unlimited.`,
    };
  }
  return { allowed: true };
}

/** Error type thrown by `assert*` helpers so actions can map it to a toast. */
export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export async function assertCanCreateClient(ctx: OrgContext): Promise<void> {
  const check = await canCreateClient(ctx);
  if (!check.allowed) throw new PlanLimitError(check.reason!);
}

export async function assertCanCreateDocument(ctx: OrgContext): Promise<void> {
  const check = await canCreateDocument(ctx);
  if (!check.allowed) throw new PlanLimitError(check.reason!);
}

type Counter = "remindersSent" | "emailsSent";

/** Increment a monthly usage counter (upsert on the current period). */
export async function incrementUsage(
  orgId: string,
  counter: Counter,
  by = 1
): Promise<void> {
  const periodStart = startOfMonth(new Date()).toISOString().slice(0, 10);
  await db
    .insert(usageCounters)
    .values({ orgId, periodStart, [counter]: by })
    .onConflictDoUpdate({
      target: [usageCounters.orgId, usageCounters.periodStart],
      set: { [counter]: sql`${usageCounters[counter]} + ${by}` },
    });
}
