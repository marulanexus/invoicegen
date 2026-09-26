"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SelectField, SwitchField, TextField } from "@/components/form/fields";
import { updateEmailSettings } from "@/server/settings/actions";
import type { EmailSettings } from "@/server/db/schema";

export function EmailSettingsForm({
  settings,
  platformAvailable,
}: {
  settings: EmailSettings | null;
  platformAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [provider, setProvider] = useState<"platform" | "smtp">(
    settings?.provider ?? "platform"
  );
  const [form, setForm] = useState({
    fromName: settings?.fromName ?? "",
    fromEmail: settings?.fromEmail ?? "",
    replyTo: settings?.replyTo ?? "",
    smtpHost: settings?.smtpHost ?? "",
    smtpPort: String(settings?.smtpPort ?? 587),
    smtpUser: settings?.smtpUser ?? "",
    smtpPassword: "",
    smtpSecure: settings?.smtpSecure ?? true,
  });
  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));
  const err = (k: string) => errors[k]?.[0];

  function save() {
    setErrors({});
    startTransition(async () => {
      const res = await updateEmailSettings({
        provider,
        fromName: form.fromName,
        fromEmail: form.fromEmail,
        replyTo: form.replyTo,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort || 587),
        smtpUser: form.smtpUser,
        smtpPassword: form.smtpPassword || undefined,
        smtpSecure: form.smtpSecure,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not save");
        return;
      }
      toast.success("Email settings saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <SelectField
            label="Sending method"
            value={provider}
            onValueChange={(v) => setProvider(v as "platform" | "smtp")}
            options={[
              {
                value: "platform",
                label: platformAvailable
                  ? "InvoiceGen default (recommended)"
                  : "InvoiceGen default (not configured)",
              },
              { value: "smtp", label: "My own SMTP server" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="From name" value={form.fromName} onValueChange={(v) => set("fromName", v)} placeholder="Your business" />
            <TextField label="From email" type="email" value={form.fromEmail} onValueChange={(v) => set("fromEmail", v)} error={err("fromEmail")} />
            <TextField label="Reply-to" type="email" value={form.replyTo} onValueChange={(v) => set("replyTo", v)} error={err("replyTo")} />
          </div>
        </CardContent>
      </Card>

      {provider === "smtp" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-sm font-semibold text-muted-foreground">SMTP server</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Host" value={form.smtpHost} onValueChange={(v) => set("smtpHost", v)} error={err("smtpHost")} placeholder="smtp.gmail.com" />
              <TextField label="Port" type="number" value={form.smtpPort} onValueChange={(v) => set("smtpPort", v)} />
              <TextField label="Username" value={form.smtpUser} onValueChange={(v) => set("smtpUser", v)} />
              <TextField
                label="Password"
                type="password"
                value={form.smtpPassword}
                onValueChange={(v) => set("smtpPassword", v)}
                hint={settings?.smtpPasswordEnc ? "Leave blank to keep current" : "App password recommended"}
              />
            </div>
            <SwitchField label="Use TLS/SSL" checked={Boolean(form.smtpSecure)} onCheckedChange={(v) => set("smtpSecure", v)} />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save email settings
        </Button>
      </div>
    </div>
  );
}
