import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "primary",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "destructive";
}) {
  const accentClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[accent];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", accentClass)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
