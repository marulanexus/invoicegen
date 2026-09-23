"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { cn } from "@/lib/utils";
import type { RevenuePoint } from "@/server/dashboard/queries";

export function RevenueCard({
  monthly,
  quarterly,
  currency,
}: {
  monthly: RevenuePoint[];
  quarterly: RevenuePoint[];
  currency: string;
}) {
  const [period, setPeriod] = useState<"monthly" | "quarterly">("monthly");

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Revenue overview</CardTitle>
        <div className="flex rounded-lg border p-0.5 text-xs">
          {(["monthly", "quarterly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium capitalize transition-colors",
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <RevenueChart
          data={period === "monthly" ? monthly : quarterly}
          currency={currency}
        />
      </CardContent>
    </Card>
  );
}
