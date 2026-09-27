import { PaymentGatewaysForm } from "@/components/settings/payment-gateways-form";
import { requireOrgContext } from "@/server/auth/context";
import { listGatewaySummaries } from "@/server/gateways/store";
import { env } from "@/lib/env";

export default async function PaymentSettingsPage() {
  const ctx = await requireOrgContext();
  const gateways = await listGatewaySummaries(ctx.org.id);
  return (
    <PaymentGatewaysForm
      gateways={gateways}
      webhooksReachable={env.APP_URL.startsWith("https://")}
    />
  );
}
