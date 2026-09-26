import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/context";
import { listDocuments } from "@/server/documents/queries";
import { formatCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { toDate } from "@/lib/format";

export const metadata = { title: "Calendar" };

interface CalEvent {
  id: string;
  date: Date;
  label: string;
  amount: string;
  kind: "due" | "expiry";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { month } = await searchParams;

  const cursor = month
    ? parse(month, "yyyy-MM", new Date())
    : new Date();
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const [invoices, quotes] = await Promise.all([
    listDocuments(ctx.org.id, { type: "invoice" }),
    listDocuments(ctx.org.id, { type: "quote" }),
  ]);

  const events: CalEvent[] = [];
  for (const inv of invoices) {
    const d = toDate(inv.dueDate);
    if (d && inv.status !== "paid" && inv.status !== "void") {
      events.push({
        id: inv.id,
        date: d,
        label: `${inv.number} due`,
        amount: formatCurrency(Number(inv.total) - Number(inv.amountPaid), inv.currency),
        kind: "due",
      });
    }
  }
  for (const q of quotes) {
    const d = toDate(q.validUntil);
    if (d && q.status === "sent") {
      events.push({
        id: q.id,
        date: d,
        label: `${q.number} expires`,
        amount: formatCurrency(q.total, q.currency),
        kind: "expiry",
      });
    }
  }

  const prev = format(subMonths(monthStart, 1), "yyyy-MM");
  const next = format(addMonths(monthStart, 1), "yyyy-MM");
  const today = new Date();

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Upcoming invoice due dates and quote expiries."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild aria-label="Previous month">
            <Link href={`/calendar?month=${prev}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {format(monthStart, "MMMM yyyy")}
          </span>
          <Button variant="outline" size="icon" asChild aria-label="Next month">
            <Link href={`/calendar?month=${next}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </PageHeader>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = events.filter((e) => isSameDay(e.date, day));
            const inMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[92px] border-b border-r p-1.5 text-xs",
                  !inMonth && "bg-muted/20 text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "mb-1 inline-grid h-6 w-6 place-items-center rounded-full",
                    isToday && "bg-primary font-semibold text-primary-foreground"
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.map((e) => (
                    <Link
                      key={e.id + e.kind}
                      href={`/documents/${e.id}`}
                      className={cn(
                        "block truncate rounded px-1.5 py-1 text-[11px] font-medium",
                        e.kind === "due"
                          ? "bg-primary/10 text-primary"
                          : "bg-warning/20 text-warning-foreground"
                      )}
                      title={`${e.label} · ${e.amount}`}
                    >
                      {e.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
