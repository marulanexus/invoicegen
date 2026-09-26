"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Share link copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} className="w-full">
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {copied ? "Copied" : "Copy share link"}
    </Button>
  );
}
