import { NextResponse } from "next/server";

import { requireOrgContext } from "@/server/auth/context";
import { getDocument } from "@/server/documents/queries";
import { renderDocumentPdf } from "@/server/pdf/render";
import { viewFromStored } from "@/lib/document-view";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await requireOrgContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const full = await getDocument(ctx.org.id, id);
  if (!full) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const view = viewFromStored(full.document, full.items, {
    showPoweredBy: !ctx.plan.features.customBranding,
  });
  const pdf = await renderDocumentPdf(view);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${full.document.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
