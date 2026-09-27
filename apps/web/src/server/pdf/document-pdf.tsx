import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { taxRatesOf, type DocumentView } from "@/lib/document-view";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";

/**
 * Printable A4 PDF. Built with @react-pdf/renderer's CSS subset so it renders
 * identically on the server (download + email attachment). Layout intentionally
 * mirrors <DocumentPreview /> so what users preview is what they send.
 */

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingVertical: 44,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#334155",
    lineHeight: 1.4,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  fromName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  muted: { color: "#64748b", fontSize: 8.5 },
  logo: { height: 42, marginBottom: 8, objectFit: "contain" },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginBottom: 8,
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 9,
  },
  docTitle: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  docNumber: { fontSize: 11, color: "#334155", marginTop: 2 },
  sectionLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  billName: { fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 2 },
  table: { marginTop: 26 },
  th: {
    flexDirection: "row",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cDesc: { flex: 1, paddingRight: 8 },
  cNum: { width: 70, textAlign: "right" },
  totals: { marginTop: 18, alignSelf: "flex-end", width: 220 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  footer: { marginTop: 28 },
  poweredBy: {
    marginTop: 22,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 7.5,
  },
});

export function DocumentPdf({ view }: { view: DocumentView }) {
  const accent = view.accentColor || "#2563eb";
  const cur = view.currency;
  const hasTax = view.taxTotal > 0;
  const hasDiscount = view.discountTotal > 0;
  const taxRates = taxRatesOf(view.items);
  // SARS: a VAT vendor shows its "VAT registration number" (and the client's).
  const taxIdLabel = view.from.vatRegistered ? "VAT No." : "Tax ID";

  return (
    <Document
      title={`${view.heading} ${view.number}`}
      author={view.from.name}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.rowBetween}>
          <View style={{ maxWidth: 280 }}>
            {view.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={view.logoUrl} style={styles.logo} />
            ) : (
              <Text style={[styles.badge, { backgroundColor: accent }]}>
                {view.from.name.charAt(0).toUpperCase()}
              </Text>
            )}
            <Text style={styles.fromName}>{view.from.name}</Text>
            {view.from.lines.map((l, i) => (
              <Text key={i} style={styles.muted}>
                {l}
              </Text>
            ))}
            {view.from.email ? <Text style={styles.muted}>{view.from.email}</Text> : null}
            {view.from.taxId ? (
              <Text style={styles.muted}>
                {taxIdLabel}: {view.from.taxId}
              </Text>
            ) : null}
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.docTitle, { color: accent }]}>
              {view.heading}
            </Text>
            <Text style={styles.docNumber}>{view.number}</Text>
            <View style={{ marginTop: 8, alignItems: "flex-end" }}>
              {view.issueDate ? (
                <Text style={styles.muted}>Issued: {formatDate(view.issueDate)}</Text>
              ) : null}
              {view.type === "invoice" && view.dueDate ? (
                <Text style={styles.muted}>Due: {formatDate(view.dueDate)}</Text>
              ) : null}
              {view.type === "quote" && view.validUntil ? (
                <Text style={styles.muted}>
                  Valid until: {formatDate(view.validUntil)}
                </Text>
              ) : null}
              {view.poNumber ? (
                <Text style={styles.muted}>PO: {view.poNumber}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Bill to */}
        {view.billTo ? (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionLabel}>Bill to</Text>
            <Text style={styles.billName}>{view.billTo.name}</Text>
            {view.billTo.lines.map((l, i) => (
              <Text key={i} style={styles.muted}>
                {l}
              </Text>
            ))}
            {view.billTo.email ? (
              <Text style={styles.muted}>{view.billTo.email}</Text>
            ) : null}
            {view.billTo.taxId ? (
              <Text style={styles.muted}>
                {taxIdLabel}: {view.billTo.taxId}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Items */}
        <View style={styles.table}>
          <View style={[styles.th, { backgroundColor: accent }]}>
            <Text style={styles.cDesc}>DESCRIPTION</Text>
            <Text style={styles.cNum}>QTY</Text>
            <Text style={styles.cNum}>RATE</Text>
            {hasDiscount ? <Text style={styles.cNum}>DISC.</Text> : null}
            {hasTax ? <Text style={styles.cNum}>TAX</Text> : null}
            <Text style={styles.cNum}>AMOUNT</Text>
          </View>

          {view.items.map((item, i) => (
            <View key={i} style={styles.tr}>
              <Text style={styles.cDesc}>{item.description || "—"}</Text>
              <Text style={styles.cNum}>{item.quantity}</Text>
              <Text style={styles.cNum}>{formatCurrency(item.unitPrice, cur)}</Text>
              {hasDiscount ? (
                <Text style={styles.cNum}>
                  {item.discountRate ? `${item.discountRate}%` : "—"}
                </Text>
              ) : null}
              {hasTax ? (
                <Text style={styles.cNum}>
                  {item.taxRate ? `${item.taxRate}%` : "—"}
                </Text>
              ) : null}
              <Text style={[styles.cNum, { fontFamily: "Helvetica-Bold" }]}>
                {formatCurrency(item.amount, cur)}
              </Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Subtotal</Text>
              <Text>{formatCurrency(view.subtotal, cur)}</Text>
            </View>
            {hasDiscount ? (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Discount</Text>
                <Text>-{formatCurrency(view.discountTotal, cur)}</Text>
              </View>
            ) : null}
            {hasTax ? (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>
                  {taxRates.length === 1 ? `${view.taxLabel} (${taxRates[0]}%)` : view.taxLabel}
                </Text>
                <Text>{formatCurrency(view.taxTotal, cur)}</Text>
              </View>
            ) : null}
            <View style={[styles.grandTotal, { backgroundColor: accent }]}>
              <Text>Total</Text>
              <Text>{formatCurrency(view.total, cur)}</Text>
            </View>
            {view.taxInclusive && hasTax ? (
              <Text style={[styles.muted, { textAlign: "right", marginTop: 4 }]}>
                Amounts include {view.taxLabel} at {taxRates.join("%, ")}%.
              </Text>
            ) : null}
            {view.amountPaid > 0 ? (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>Paid</Text>
                  <Text>-{formatCurrency(view.amountPaid, cur)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Balance due</Text>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>
                    {formatCurrency(view.balanceDue, cur)}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Notes / terms */}
        <View style={styles.footer}>
          {view.notes ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.muted}>{view.notes}</Text>
            </View>
          ) : null}
          {view.terms ? (
            <View>
              <Text style={styles.sectionLabel}>Terms & conditions</Text>
              <Text style={styles.muted}>{view.terms}</Text>
            </View>
          ) : null}
          {view.showPoweredBy ? (
            <Text style={styles.poweredBy}>Powered by InvoiceGen</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
