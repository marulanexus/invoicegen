import { apiData, apiError, apiResult, isUuid, readJson, withApiAuth } from "@/server/api/http";
import { getDocument } from "@/server/documents/queries";
import { getTaxInvoiceStatus } from "@/server/documents/tax-invoice";
import { listProofs } from "@/server/proofs/service";
import { updateDocumentForOrg } from "@/server/documents/service";

type Params = { id: string };

const notFound = () => apiError(404, "not_found", "Document not found.");

/** The document with its client, line items, payments and SARS tax invoice status. */
export const GET = withApiAuth<Params>(async (ctx, _req, { id }) => {
  if (!isUuid(id)) return notFound();
  const full = await getDocument(ctx.org.id, id);
  if (!full) return notFound();
  // heading ("TAX INVOICE"…) and SARS problems that block issuing a draft.
  const [taxInvoice, proofs] = await Promise.all([
    getTaxInvoiceStatus(ctx, full.document, full.items),
    listProofs(ctx.org.id, full.document.id),
  ]);
  return apiData({ ...full, taxInvoice, proofs });
});

/** Replace the document's editable fields and line items. `type` is ignored. */
export const PUT = withApiAuth<Params>(async (ctx, req, { id }) => {
  if (!isUuid(id)) return notFound();
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await updateDocumentForOrg(ctx, id, body));
});
