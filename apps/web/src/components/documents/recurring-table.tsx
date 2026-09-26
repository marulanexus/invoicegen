"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  deleteRecurring,
  setRecurringActive,
} from "@/server/documents/recurring-actions";
import type { RecurringWithClient } from "@/server/documents/recurring-queries";

export function RecurringTable({ rows }: { rows: RecurringWithClient[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      const res = await setRecurringActive(id, !active);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      toast.success(active ? "Paused" : "Resumed");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this recurring schedule?")) return;
    startTransition(async () => {
      const res = await deleteRecurring(id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      toast.success("Schedule deleted");
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Cadence</TableHead>
            <TableHead className="hidden sm:table-cell">Next run</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.clientName ?? "—"}</TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {r.interval > 1 ? `Every ${r.interval} ` : ""}
                {r.frequency}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {formatDate(r.nextRunDate)}
              </TableCell>
              <TableCell>
                <Badge variant={r.active ? "success" : "secondary"}>
                  {r.active ? "Active" : "Paused"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => toggle(r.id, r.active)}
                    aria-label={r.active ? "Pause" : "Resume"}
                  >
                    {r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => remove(r.id)}
                    aria-label="Delete"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
