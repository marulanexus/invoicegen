import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { activityLogs, members } from "@/server/db/schema";

interface LogInput {
  orgId: string;
  actorMemberId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/** Append an entry to the org activity feed. Never throws into the caller. */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      orgId: input.orgId,
      actorMemberId: input.actorMemberId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description,
      metadata: input.metadata,
    });
  } catch (err) {
    console.error("[activity] failed to log", input.action, err);
  }
}

export interface ActivityEntry {
  id: string;
  action: string;
  description: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
  actorName: string | null;
}

/** Recent activity for the org, newest first, with actor names resolved. */
export async function listActivity(
  orgId: string,
  limit = 100
): Promise<ActivityEntry[]> {
  const rows = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      description: activityLogs.description,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      createdAt: activityLogs.createdAt,
      actorName: members.name,
    })
    .from(activityLogs)
    .leftJoin(members, eq(activityLogs.actorMemberId, members.id))
    .where(eq(activityLogs.orgId, orgId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
  return rows;
}
