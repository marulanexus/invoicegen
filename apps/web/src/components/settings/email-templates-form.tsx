"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TextAreaField, TextField } from "@/components/form/fields";
import {
  TEMPLATE_VARIABLES,
  type EmailTemplateKind,
} from "@/server/email/templates";
import { updateEmailTemplate } from "@/server/settings/actions";

type TemplateMap = Record<EmailTemplateKind, { subject: string; body: string }>;

const KINDS: { value: EmailTemplateKind; label: string }[] = [
  { value: "invoice", label: "Invoice" },
  { value: "quote", label: "Quote" },
  { value: "receipt", label: "Receipt" },
  { value: "reminder", label: "Reminder" },
];

export function EmailTemplatesForm({ templates }: { templates: TemplateMap }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<TemplateMap>(templates);

  function set(kind: EmailTemplateKind, patch: Partial<{ subject: string; body: string }>) {
    setState((s) => ({ ...s, [kind]: { ...s[kind], ...patch } }));
  }

  function save(kind: EmailTemplateKind) {
    startTransition(async () => {
      const res = await updateEmailTemplate({
        kind,
        subject: state[kind].subject,
        body: state[kind].body,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save");
        return;
      }
      toast.success("Template saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customize the emails sent with each document type. Use variables and
        they&apos;ll be filled in automatically when you send.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_VARIABLES.map((v) => (
          <Badge key={v} variant="secondary" className="font-mono text-[11px]">
            {v}
          </Badge>
        ))}
      </div>

      <Tabs defaultValue="invoice">
        <TabsList>
          {KINDS.map((k) => (
            <TabsTrigger key={k.value} value={k.value}>
              {k.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {KINDS.map((k) => (
          <TabsContent key={k.value} value={k.value}>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <TextField
                  label="Subject"
                  value={state[k.value].subject}
                  onValueChange={(v) => set(k.value, { subject: v })}
                />
                <TextAreaField
                  label="Body"
                  value={state[k.value].body}
                  onValueChange={(v) => set(k.value, { body: v })}
                  className="[&_textarea]:min-h-40"
                />
                <div className="flex justify-end">
                  <Button onClick={() => save(k.value)} disabled={pending}>
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save {k.label.toLowerCase()} template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
