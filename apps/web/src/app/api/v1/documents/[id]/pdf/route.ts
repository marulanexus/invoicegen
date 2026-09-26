import { apiError, isUuid, withApiAuth } from "@/server/api/http";
import { getDocument } from "@/server/documents/queries";
import { renderDocumentPdf } from "@/server/pdf/render";
import { viewFromStored } from "@/lib/document-view";

export const runtime = "nodejs";

/** The document as a PDF file (rendered fresh, same as the web download). */
export const GET = withApiAuth<{ id: string }>(async (ctx, _req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Document not found.");
  const full = await getDocument(ctx.org.id, id);
  if (!full) return apiError(404, "not_found", "Document not found.");

  const view = viewFromStored(full.document, full.items, {
    showPoweredBy: !ctx.plan.features.customBranding,
  });
  const pdf = await renderDocumentPdf(view);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${full.document.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
