/**
 * `/api/v1` response contract, as the mobile app consumes it.
 *
 * Money arrives as decimal strings ("1150.00") from the database; dashboard
 * aggregates arrive as numbers. Dates are ISO strings (`YYYY-MM-DD` for
 * calendar dates, full timestamps otherwise).
 */

export type ApiSuccess<T> = { data: T };

export type ApiErrorBody = {
  error: {
    code:
      | "validation"
      | "not_found"
      | "plan_limit"
      | "conflict"
      | "rate_limited"
      | "upstream"
      | "unauthenticated"
      | "bad_request"
      | "internal";
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export type DocumentType = "invoice" | "quote" | "receipt" | "credit_note" | "debit_note";

export type DocumentStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partial"
  | "paid"
  | "overdue"
  | "void"
  | "accepted"
  | "declined";

export type StatusAction = "send" | "mark_paid" | "void" | "accept" | "decline" | "reopen";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "paypal"
  | "stripe"
  | "other"
  | "payfast"
  | "yoco";

export interface Me {
  org: { id: string; name: string };
  member: { id: string; name: string | null; email: string; role: string; avatarUrl: string | null };
  plan: {
    id: "free" | "growth" | "business";
    name: string;
    limits: { maxClients: number; maxDocumentsPerMonth: number; maxSeats: number };
    features: Record<string, boolean>;
  };
  onboardingCompleted: boolean;
  business: {
    displayName: string;
    logoUrl: string | null;
    defaultCurrency: string;
    taxLabel: string | null;
    defaultTaxRate: string | null;
    taxInclusive: boolean;
  } | null;
}

export interface Client {
  id: string;
  name: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  taxId: string | null;
  currency: string | null;
  taxRate: string | null;
  notes: string | null;
  tags: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ClientWithStats extends Client {
  stats: { documentCount: number; outstanding: number; totalPaid: number };
}

/** Body for POST/PUT /clients. */
export interface ClientInput {
  name: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  currency?: string;
  notes?: string;
  tags?: string[];
}

export interface Document {
  id: string;
  clientId: string | null;
  type: DocumentType;
  number: string;
  status: DocumentStatus;
  currency: string;
  issueDate: string;
  dueDate: string | null;
  validUntil: string | null;
  poNumber: string | null;
  templateKey: string;
  taxLabel: string | null;
  taxInclusive: boolean;
  notes: string | null;
  terms: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  /** Invoices: debit notes minus credit notes. Owed = total + adjustmentTotal − amountPaid. */
  adjustmentTotal: string;
  /** Credit/debit notes: the invoice they adjust, and why. */
  relatedDocumentId: string | null;
  reason: string | null;
  billToSnapshot: { name?: string; email?: string | null; [k: string]: unknown } | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListItem extends Document {
  clientName: string | null;
}

export interface LineItem {
  id: string;
  position: number;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
  amount: string;
}

export interface Payment {
  id: string;
  documentId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: string;
}

export interface FullDocument {
  document: Document;
  client: Client | null;
  items: LineItem[];
  payments: Payment[];
  /** SARS status: heading ("TAX INVOICE"…) and what blocks issuing a draft. */
  taxInvoice: {
    heading: string;
    vatRegistered: boolean;
    problems: import("./tax-invoice").TaxInvoiceProblem[];
    /** Issued tax invoice or note: edit/reopen/void/delete are refused; use notes. */
    locked: boolean;
  };
  /** Credit/debit notes: the invoice they adjust. */
  related: { id: string; number: string; type: DocumentType; issueDate: string | null } | null;
  /** Invoices: credit/debit notes issued against it, oldest first. */
  notes: Document[];
  /** Invoices: proofs of payment uploaded by the payer, newest first. */
  proofs: PaymentProof[];
}

export interface PaymentProof {
  id: string;
  documentId: string;
  fileName: string;
  contentType: string;
  size: number;
  /** What the payer says they paid, if given. */
  amount: string | null;
  paidOn: string | null;
  reference: string | null;
  note: string | null;
  status: "pending" | "accepted" | "rejected";
  rejectionReason: string | null;
  paymentId: string | null;
  createdAt: string;
}

/** Body for POST /documents/:id/notes. Amounts include VAT. */
export interface NoteInput {
  kind: "credit" | "debit";
  reason: string;
  mode?: "full" | "amount";
  amount?: number;
  description?: string;
  taxRate?: number;
  issueDate?: string;
}

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  /** Omit to use the business's default tax rate. */
  taxRate?: number;
}

/** Body for POST /documents. Omitted fields default from the business profile. */
export interface DocumentCreateInput {
  type: DocumentType;
  clientId?: string | null;
  issueDate?: string;
  dueDate?: string | null;
  validUntil?: string | null;
  notes?: string;
  lineItems: LineItemInput[];
}

export interface PaymentInput {
  documentId: string;
  amount: number;
  method: PaymentMethod;
  /** `YYYY-MM-DD` or ISO timestamp with offset. */
  paidAt: string;
  reference?: string;
  notes?: string;
}

export interface PaymentListItem {
  id: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  documentId: string;
  documentNumber: string | null;
  clientName: string | null;
}

export interface Dashboard {
  currency: string | null;
  metrics: { totalRevenue: number; outstanding: number; overdue: number; activeClients: number };
  revenue: { period: "monthly" | "quarterly"; points: { month: string; revenue: number }[] };
  dueSoon: {
    id: string;
    number: string;
    clientName: string | null;
    dueDate: string | null;
    balance: number;
    currency: string;
    overdue: boolean;
  }[];
  recentPayments: PaymentListItem[];
  recentDocuments: Pick<
    DocumentListItem,
    "id" | "type" | "number" | "status" | "clientName" | "issueDate" | "dueDate" | "total" | "amountPaid" | "currency"
  >[];
}
