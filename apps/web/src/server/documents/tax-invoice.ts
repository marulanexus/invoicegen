import "server-only";

import { and, eq } from "drizzle-orm";
import {
  documentHeading,
  taxInvoiceProblems,
  type TaxInvoiceInput,
  type TaxInvoiceProblem,
} from "@invoicegen/shared/tax-invoice";

import { db } from "@/server/db";
import { clients, documents, lineItems, type Document, type LineItem } from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { snapshotBillTo, snapshotFrom } from "@/server/documents/snapshots";
import { fail, ok, type ServiceResult } from "@/server/service-result";
import { toNumber } from "@/lib/money";

/**
 * SARS tax invoice checks for stored documents. Details on a document freeze
 * when it's issued (sent, emailed or shared), so a draft is always checked,
 * and issued, against the business's and client's *current* details.
 */

type Snapshot = Record<string, unknown> | null | undefined;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Address lines without the country line, which alone isn't an address. */
function addressLines(snap: Snapshot): string[] {
  const lines = Array.isArray(snap?.address) ? snap.address.filter((l): l is string => typeof l === "string" && !!l.trim()) : [];
  const country = str(snap?.country)?.toLowerCase();
  return lines.filter((l) => l.trim().toLowerCase() !== country);
}

export function taxInvoiceInput(
  doc: Pick<Document, "type" | "currency" | "total" | "taxTotal" | "fromSnapshot" | "billToSnapshot">,
  items: Pick<LineItem, "description" | "taxRate">[]
): TaxInvoiceInput {
  const from = doc.fromSnapshot;
  const to = doc.billToSnapshot;
  return {
    type: doc.type,
    currency: doc.currency,
    total: toNumber(doc.total),
    taxTotal: toNumber(doc.taxTotal),
    lines: items.map((i) => ({ description: i.description, taxRate: toNumber(i.taxRate) })),
    supplier: {
      name: str(from?.name),
      address: addressLines(from),
      vatNumber: str(from?.taxId),
      country: str(from?.country),
      vatRegistered: from?.vatRegistered === true,
    },
    recipient: to
      ? { name: str(to.name), address: addressLines(to), vatNumber: str(to.taxId), country: str(to.country) }
      : null,
  };
}

/** Snapshots a draft would be issued with: current business and client details. */
async function issueSnapshots(ctx: OrgContext, doc: Document) {
  const [client] = doc.clientId
    ? await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, doc.clientId), eq(clients.orgId, ctx.org.id)))
        .limit(1)
    : [];
  return {
    fromSnapshot: snapshotFrom(ctx.profile) ?? doc.fromSnapshot,
    billToSnapshot: snapshotBillTo(client) ?? doc.billToSnapshot,
  };
}

async function loadItems(documentId: string) {
  return db.select().from(lineItems).where(eq(lineItems.documentId, documentId)).orderBy(lineItems.position);
}

export interface TaxInvoiceStatus {
  heading: string;
  vatRegistered: boolean;
  problems: TaxInvoiceProblem[];
}

/** A draft as it would be issued now (current details); issued documents unchanged. */
export async function asIssued(ctx: OrgContext, doc: Document): Promise<Document> {
  return doc.status === "draft" ? { ...doc, ...(await issueSnapshots(ctx, doc)) } : doc;
}

/** How the document will be titled and what (if anything) blocks issuing it. */
export async function getTaxInvoiceStatus(ctx: OrgContext, doc: Document, items?: LineItem[]): Promise<TaxInvoiceStatus> {
  const input = taxInvoiceInput(await asIssued(ctx, doc), items ?? (await loadItems(doc.id)));
  return {
    heading: documentHeading(doc.type, input.supplier.vatRegistered),
    vatRegistered: input.supplier.vatRegistered,
    problems: taxInvoiceProblems(input),
  };
}

/** One message listing what to fix, for callers that can only show text. */
export function problemsMessage(problems: TaxInvoiceProblem[]): string {
  return `Fix before sending: ${problems.map((p) => p.message).join(" ")}`;
}

/**
 * Before a draft reaches the client: freeze current business/client details
 * onto it and check the SARS rules. Already-issued documents pass unchanged.
 */
export async function prepareIssue(ctx: OrgContext, doc: Document): Promise<ServiceResult<Document>> {
  if (doc.status !== "draft") return ok(doc);

  const snaps = await issueSnapshots(ctx, doc);
  const problems = taxInvoiceProblems(taxInvoiceInput({ ...doc, ...snaps }, await loadItems(doc.id)));
  if (problems.length) return fail("conflict", problemsMessage(problems));

  const [updated] = await db
    .update(documents)
    .set({ ...snaps, updatedAt: new Date() })
    .where(and(eq(documents.id, doc.id), eq(documents.orgId, ctx.org.id)))
    .returning();
  return ok(updated ?? doc);
}
