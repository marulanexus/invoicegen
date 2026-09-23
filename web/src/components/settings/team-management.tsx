"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

/**
 * Real team management is delegated to Clerk's Organization UI. The switcher's
 * "Manage organization" modal provides invite / remove / role management, and
 * "Create organization" lets a solo user start a team workspace. Seats are
 * still gated by plan in our app (see the Team settings page).
 */
export function TeamManagement() {
  return (
    <div className="rounded-lg border p-4">
      <OrganizationSwitcher
        hidePersonal={false}
        afterCreateOrganizationUrl="/dashboard"
        afterSelectOrganizationUrl="/dashboard"
        appearance={{ elements: { rootBox: "w-full", organizationSwitcherTrigger: "w-full justify-between" } }}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Use “Manage organization” to invite teammates, assign roles, or remove
        members. Create an organization to turn your personal workspace into a
        shared team.
      </p>
    </div>
  );
}
