import { apiError, apiResult, isUuid, withApiAuth } from "@/server/api/http";
import { convertQuoteToInvoiceForOrg } from "@/server/documents/service";

/** Turn a quote into a new draft invoice; returns the invoice. */
export const POST = withApiAuth<{ id: string }>(async (ctx, _req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Quote not found.");
  return apiResult(await convertQuoteToInvoiceForOrg(ctx, id), 201);
});
