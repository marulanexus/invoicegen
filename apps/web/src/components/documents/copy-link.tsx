"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { shareDocument } from "@/server/documents/actions";

/**
 * Copy the client link. The server hands it out, so a draft is checked
 * against the SARS rules and issued (marked sent) first, like emailing it.
 */
export function CopyLink({ id, isDraft }: { id: string; isDraft: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copy() {
    startTransition(async () => {
      const res = await shareDocument(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
        setCopied(true);
        toast.success(isDraft ? "Marked as sent and link copied" : "Share link copied");
      } catch {
        // Clipboard blocked: still give the owner the link.
        toast.message(isDraft ? "Marked as sent. Copy the link:" : "Copy the link:", { description: res.url, duration: 15000 });
      }
      setTimeout(() => setCopied(false), 2000);
      if (isDraft) router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} disabled={pending} className="w-full">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {copied ? "Copied" : isDraft ? "Send by link (copy)" : "Copy share link"}
    </Button>
  );
}
