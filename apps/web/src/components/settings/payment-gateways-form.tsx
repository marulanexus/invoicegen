"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/form/fields";
import { connectPayfast, connectYoco, disconnectGateway } from "@/server/gateways/actions";
import type { GatewaySummary } from "@/server/gateways/store";

type Provider = "payfast" | "yoco";

function Status({ gateway }: { gateway?: GatewaySummary }) {
  if (!gateway) return <Badge variant="secondary">Not connected</Badge>;
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success">Connected</Badge>
      <Badge variant={gateway.mode === "live" ? "default" : "warning"}>
        {gateway.mode === "live" ? "Live" : "Test mode"}
      </Badge>
    </div>
  );
}

export function PaymentGatewaysForm({
  gateways,
  webhooksReachable,
}: {
  gateways: GatewaySummary[];
  /** False on localhost: payment notifications can't reach this server. */
  webhooksReachable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const payfast = gateways.find((g) => g.provider === "payfast");
  const yoco = gateways.find((g) => g.provider === "yoco");

  const [pf, setPf] = useState({
    merchantId: payfast?.merchantId ?? "",
    merchantKey: "",
    passphrase: "",
    mode: payfast?.mode ?? "test",
  });
  const [yocoKey, setYocoKey] = useState("");
  const err = (k: string) => errors[k]?.[0];

  function savePayfast() {
    setErrors({});
    startTransition(async () => {
      const res = await connectPayfast(pf);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not connect PayFast");
        return;
      }
      setPf((p) => ({ ...p, merchantKey: "", passphrase: "" }));
      toast.success("PayFast connected");
      router.refresh();
    });
  }

  function saveYoco() {
    setErrors({});
    startTransition(async () => {
      const res = await connectYoco({ secretKey: yocoKey });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not connect Yoco");
        return;
      }
      setYocoKey("");
      if (res.webhookRegistered) toast.success("Yoco connected");
      else toast.warning("Yoco connected, but payment notifications aren't set up yet (needs a public HTTPS address).");
      router.refresh();
    });
  }

  function disconnect(provider: Provider) {
    startTransition(async () => {
      const res = await disconnectGateway(provider);
      if (!res.ok) {
        toast.error(res.error ?? "Could not disconnect");
        return;
      }
      toast.success(`${provider === "payfast" ? "PayFast" : "Yoco"} disconnected`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Connect your own PayFast or Yoco account to add a <strong>Pay now</strong> button to
        your shared invoices. Money goes straight to your account; InvoiceGen records the
        payment automatically once the provider confirms it. Online payment works for
        invoices in rand (ZAR).
      </p>

      {!webhooksReachable && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          This server isn&apos;t on a public HTTPS address, so PayFast and Yoco can&apos;t send
          payment confirmations here. Payments will go through, but won&apos;t be recorded
          automatically until the app runs on its public address.
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">PayFast</h2>
              <p className="text-xs text-muted-foreground">EFT, card, SnapScan, Zapper and more.</p>
            </div>
            <Status gateway={payfast} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Merchant ID" value={pf.merchantId} onValueChange={(v) => setPf({ ...pf, merchantId: v })} error={err("merchantId")} placeholder="10000100" />
            <TextField label="Merchant key" type="password" value={pf.merchantKey} onValueChange={(v) => setPf({ ...pf, merchantKey: v })} error={err("merchantKey")} hint={payfast ? "Enter again to update the connection" : undefined} />
            <TextField label="Passphrase" type="password" value={pf.passphrase} onValueChange={(v) => setPf({ ...pf, passphrase: v })} error={err("passphrase")} hint={payfast ? "Leave blank to keep current" : "From Settings → Security in PayFast, if set"} />
            <SelectField
              label="Mode"
              value={pf.mode}
              onValueChange={(v) => setPf({ ...pf, mode: v })}
              options={[
                { value: "test", label: "Sandbox (testing)" },
                { value: "live", label: "Live" },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2">
            {payfast && (
              <Button variant="outline" onClick={() => disconnect("payfast")} disabled={pending}>
                Disconnect
              </Button>
            )}
            <Button onClick={savePayfast} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {payfast ? "Update PayFast" : "Connect PayFast"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Yoco</h2>
              <p className="text-xs text-muted-foreground">Card, Apple Pay and Google Pay.</p>
            </div>
            <Status gateway={yoco} />
          </div>
          {yoco && !yoco.webhookRegistered && (
            <p className="text-xs text-warning-foreground">
              Payment notifications aren&apos;t registered. Reconnect once the app is on its public HTTPS address.
            </p>
          )}
          <TextField
            label="Secret key"
            type="password"
            value={yocoKey}
            onValueChange={setYocoKey}
            error={err("secretKey")}
            placeholder="sk_test_… or sk_live_…"
            hint="Yoco app → Selling online → Payment gateway → API keys"
          />
          <div className="flex justify-end gap-2">
            {yoco && (
              <Button variant="outline" onClick={() => disconnect("yoco")} disabled={pending}>
                Disconnect
              </Button>
            )}
            <Button onClick={saveYoco} disabled={pending || !yocoKey}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {yoco ? "Update Yoco" : "Connect Yoco"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
