"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { Document } from "@/server/db/schema";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/form/fields";
import { DocumentActions } from "@/components/documents/document-actions";
import { sendDocument } from "@/server/documents/send";

export function DocumentDetailActions({
  id,
  type,
  status,
  number,
  defaultEmail,
  locked = false,
}: {
  id: string;
  type: Document["type"];
  status: string;
  number: string;
  defaultEmail?: string | null;
  locked?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [to, setTo] = useState(defaultEmail ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function send() {
    startTransition(async () => {
      const res = await sendDocument(id, { to, subject, message });
      if (!res.ok) {
        toast.error(res.error ?? "Could not send");
        return;
      }
      toast.success(`${number} sent to ${to}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DocumentActions
        id={id}
        type={type}
        status={status}
        locked={locked}
        onSend={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {number}</DialogTitle>
            <DialogDescription>
              We&apos;ll email a PDF copy to your client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <TextField
              label="To"
              type="email"
              value={to}
              onValueChange={setTo}
              placeholder="client@example.com"
              required
            />
            <TextField
              label="Subject"
              value={subject}
              onValueChange={setSubject}
              placeholder="Leave blank for a sensible default"
            />
            <TextAreaField
              label="Message"
              value={message}
              onValueChange={setMessage}
              placeholder="Optional note to your client"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={pending || !to}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
