"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setClientStatus } from "@/server/clients/actions";

export function ClientActions({
  clientId,
  status,
}: {
  clientId: string;
  status: "active" | "archived";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleArchive() {
    const next = status === "archived" ? "active" : "archived";
    startTransition(async () => {
      const res = await setClientStatus(clientId, next);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      toast.success(next === "archived" ? "Client archived" : "Client restored");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={pending} aria-label="Client actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/clients/${clientId}/edit`)}>
          <Pencil className="h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleArchive}>
          {status === "archived" ? (
            <>
              <ArchiveRestore className="h-4 w-4" /> Restore
            </>
          ) : (
            <>
              <Archive className="h-4 w-4" /> Archive
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
