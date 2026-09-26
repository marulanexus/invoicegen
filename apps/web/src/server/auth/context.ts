import "server-only";

import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  businessProfiles,
  members,
  organizations,
  subscriptions,
  type BusinessProfile,
  type Member,
  type Organization,
} from "@/server/db/schema";
import { getPlan, type Plan } from "@/lib/plans";

export interface OrgContext {
  org: Organization;
  member: Member;
  profile: BusinessProfile | null;
  plan: Plan;
  onboardingCompleted: boolean;
}

/**
 * Resolve (and lazily provision) the current tenant.
 *
 * Tenancy key: an active Clerk Organization id when present, otherwise a
 * synthetic `user:<id>` so solo users get a private workspace with zero setup.
 * Memoized per request via React `cache()`.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const clerkOrgId = orgId ?? `user:${userId}`;
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    "";
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;

  // 1. Ensure the organization exists.
  let [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);

  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({
        clerkOrgId,
        name: orgId ? "My Organization" : name ? `${name}'s Workspace` : "My Workspace",
      })
      .onConflictDoNothing({ target: organizations.clerkOrgId })
      .returning();

    // Lost an insert race — read the existing row.
    if (!org) {
      [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkOrgId, clerkOrgId))
        .limit(1);
    }

    // Seed a default (free) subscription row for the new org.
    if (org) {
      await db
        .insert(subscriptions)
        .values({ orgId: org.id, plan: "free", status: "active", seats: 1 })
        .onConflictDoNothing({ target: subscriptions.orgId });
    }
  }

  if (!org) return null;

  // 2. Ensure membership. The first member of a personal workspace is owner.
  let [member] = await db
    .select()
    .from(members)
    .where(eq(members.clerkUserId, userId))
    .limit(1);

  if (!member || member.orgId !== org.id) {
    [member] = await db
      .insert(members)
      .values({
        orgId: org.id,
        clerkUserId: userId,
        email,
        name,
        avatarUrl: user?.imageUrl ?? null,
        role: orgId ? "member" : "owner",
      })
      .onConflictDoNothing()
      .returning();

    if (!member) {
      [member] = await db
        .select()
        .from(members)
        .where(eq(members.clerkUserId, userId))
        .limit(1);
    }
  }

  // 3. Load the business profile (created during onboarding).
  const [profile] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.orgId, org.id))
    .limit(1);

  return {
    org,
    member: member!,
    profile: profile ?? null,
    plan: getPlan(org.plan),
    onboardingCompleted: Boolean(profile?.onboardingCompleted),
  };
});

/** Throw-if-missing variant for server actions/routes that require a tenant. */
export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("UNAUTHENTICATED");
  return ctx;
}
