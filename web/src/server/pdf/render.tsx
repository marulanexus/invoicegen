import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { DocumentPdf } from "./document-pdf";
import type { DocumentView } from "@/lib/document-view";

/** Render a document view to a PDF byte buffer (server-only). */
export async function renderDocumentPdf(view: DocumentView): Promise<Buffer> {
  return renderToBuffer(<DocumentPdf view={view} />);
}
