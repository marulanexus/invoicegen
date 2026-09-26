import { NextResponse } from "next/server";

import { getPublicDocument } from "@/server/documents/public";
import { renderDocumentPdf } from "@/server/pdf/render";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rl = rateLimit(`pubpdf:${clientKey(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
    );
  }

  const doc = await getPublicDocument(token);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await renderDocumentPdf(doc.view);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
