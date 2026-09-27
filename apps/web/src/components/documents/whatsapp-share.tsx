"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shareMessage, whatsappNumber, whatsappUrl, type ShareMessageInput } from "@invoicegen/shared/whatsapp";

import { Button } from "@/components/ui/button";
import { shareDocument } from "@/server/documents/actions";

/**
 * Send the document's link on WhatsApp, straight to the client's chat when
 * their mobile number is on file. The server hands out the link, so a draft
 * is checked against the SARS rules and marked sent first (like emailing).
 */
export function WhatsAppShare({
  id,
  isDraft,
  phone,
  message,
}: {
  id: string;
  isDraft: boolean;
  phone?: string | null;
  /** Everything for the message except the link, which the server provides. */
  message: Omit<ShareMessageInput, "url">;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const direct = Boolean(whatsappNumber(phone));

  function share() {
    // Open the tab now, while the click still counts as the user's: browsers
    // block windows opened after waiting on the server.
    const tab = window.open("about:blank", "_blank");
    startTransition(async () => {
      const res = await shareDocument(id);
      if (!res.ok) {
        tab?.close();
        toast.error(res.error);
        return;
      }
      const href = whatsappUrl(shareMessage({ ...message, url: res.url }), phone);
      if (tab) {
        tab.opener = null;
        tab.location.href = href;
      } else {
        window.location.href = href;
      }
      if (isDraft) {
        toast.success("Marked as sent");
        router.refresh();
      }
    });
  }

  return (
    <Button
      size="sm"
      onClick={share}
      disabled={pending}
      className="w-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
        </svg>
      )}
      {direct ? "Send on WhatsApp" : "Share on WhatsApp"}
    </Button>
  );
}
