import { eq } from "drizzle-orm";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/context";
import { TeamManagement } from "@/components/settings/team-management";
import { db } from "@/server/db";
import { members } from "@/server/db/schema";
import { initials } from "@/lib/format";

export default async function TeamSettingsPage() {
  const ctx = await requireOrgContext();
  const team = await db
    .select()
    .from(members)
    .where(eq(members.orgId, ctx.org.id));

  const maxSeats = ctx.plan.limits.maxSeats;
  const canInvite = ctx.plan.features.multipleSeats;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Team members</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {team.length} of {maxSeats} {maxSeats === 1 ? "seat" : "seats"} used
            </p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </span>
        </CardHeader>
        <CardContent className="space-y-2">
          {team.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(m.name ?? m.email)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name ?? m.email}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Badge variant="secondary" className="ml-auto capitalize">
                {m.role}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {canInvite && <TeamManagement />}

      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        {canInvite ? (
          <p>
            Each member uses one seat on your <strong>{ctx.plan.name}</strong>{" "}
            plan ({maxSeats} seats included).
          </p>
        ) : (
          <p>
            Team seats are available on the <strong>Business Plus</strong> plan.
            Upgrade in{" "}
            <a href="/settings/billing" className="font-medium text-primary hover:underline">
              Billing
            </a>{" "}
            to invite teammates.
          </p>
        )}
      </div>
    </div>
  );
}
