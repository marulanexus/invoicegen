import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/context";
import { listActivity } from "@/server/activity";
import { formatRelative, initials } from "@/lib/format";

export default async function ActivityPage() {
  const ctx = await requireOrgContext();
  const entries = await listActivity(ctx.org.id, 100);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity yet"
        description="Actions like creating clients, sending invoices and recording payments will appear here."
      />
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ol className="relative space-y-5 border-l pl-6">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full border bg-card text-[10px] font-semibold text-muted-foreground">
                {initials(e.actorName)}
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm">
                  <span className="font-medium">{e.actorName ?? "System"}</span>{" "}
                  <span className="text-muted-foreground">
                    {e.description ?? e.action.replace(/[._]/g, " ")}
                  </span>
                  {e.entityType === "document" && e.entityId && (
                    <>
                      {" · "}
                      <Link
                        href={`/documents/${e.entityId}`}
                        className="text-primary hover:underline"
                      >
                        view
                      </Link>
                    </>
                  )}
                </p>
                <time className="text-xs text-muted-foreground">
                  {formatRelative(e.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
