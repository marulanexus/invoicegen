import "server-only";

import { after } from "next/server";

import { sendPushToOrg, type PushNotification } from "@/server/notifications/push";
import { formatCurrency } from "@/lib/money";

/**
 * The moments an owner hears about on their phone. Pushes are sent after the
 * response (Next's `after`), so webhooks and pages never wait on Expo.
 */

function dispatch(orgId: string, n: PushNotification): void {
  try {
    after(() => sendPushToOrg(orgId, n));
  } catch {
    // Outside a request (scripts, tests): send without blocking the caller.
    void sendPushToOrg(orgId, n);
  }
}

const PROVIDER = { payfast: "PayFast", yoco: "Yoco" } as const;

export function notifyOnlinePayment(
  orgId: string,
  p: { documentId: string; number: string; amount: number; currency: string; provider: keyof typeof PROVIDER; clientName?: string | null; fullyPaid: boolean }
): void {
  dispatch(orgId, {
    title: `${formatCurrency(p.amount, p.currency)} received`,
    body: `${p.clientName ? `${p.clientName} paid ` : ""}${p.number} via ${PROVIDER[p.provider]}${p.fullyPaid ? " — paid in full" : ""}.`,
    data: { documentId: p.documentId, kind: "payment" },
  });
}

export function notifyDocumentViewed(
  orgId: string,
  d: { documentId: string; number: string; clientName?: string | null }
): void {
  dispatch(orgId, {
    title: `${d.number} was opened`,
    body: `${d.clientName ?? "Your client"} just viewed ${d.number}.`,
    data: { documentId: d.documentId, kind: "viewed" },
  });
}

export function notifyOverdue(
  orgId: string,
  invoices: { documentId: string; number: string; balance: number; currency: string; clientName?: string | null }[]
): void {
  if (invoices.length === 0) return;
  const [first] = invoices;
  dispatch(
    orgId,
    invoices.length === 1
      ? {
          title: `${first.number} is overdue`,
          body: `${first.clientName ?? "Your client"} still owes ${formatCurrency(first.balance, first.currency)}.`,
          data: { documentId: first.documentId, kind: "overdue" },
        }
      : {
          title: `${invoices.length} invoices are overdue`,
          body: invoices.map((i) => i.number).slice(0, 5).join(", ") + (invoices.length > 5 ? "…" : ""),
          data: { kind: "overdue" },
        }
  );
}

export function notifyProofReceived(
  orgId: string,
  p: { documentId: string; number: string; amount: string | null; clientName?: string | null }
): void {
  dispatch(orgId, {
    title: `Proof of payment for ${p.number}`,
    body: `${p.clientName ?? "Your client"} uploaded proof of payment${p.amount ? ` for ${p.amount}` : ""}. Check it and record the payment.`,
    data: { documentId: p.documentId, kind: "proof" },
  });
}
