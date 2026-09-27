import { useAuth } from '@clerk/expo';
import { useCallback, useMemo } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import type {
  ApiErrorBody,
  Client,
  ClientInput,
  ClientWithStats,
  Dashboard,
  Document,
  DocumentCreateInput,
  DocumentListItem,
  DocumentStatus,
  DocumentType,
  FullDocument,
  Me,
  NoteInput,
  Payment,
  PaymentInput,
  RefundInput,
  PaymentMethod,
  PaymentProof,
  PaymentListItem,
  StatusAction,
} from '@invoicegen/shared/api';

import { API_URL } from '@/lib/config';

/** A failed API call, carrying the server's error code and field errors. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ApiErrorBody['error']['code'] | 'network',
    readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message);
  }
}

type GetToken = () => Promise<string | null>;

async function request<T>(getToken: GetToken, method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach InvoiceGen. Check your connection.", 0, 'network');
  }

  const json = (await res.json().catch(() => null)) as { data: T } | ApiErrorBody | null;
  if (!res.ok || !json || !('data' in json)) {
    const err = json && 'error' in json ? json.error : null;
    throw new ApiError(err?.message ?? 'Something went wrong.', res.status, err?.code ?? 'internal', err?.fieldErrors);
  }
  return json.data;
}

function query(params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

/** Typed `/api/v1` client, authenticated with the signed-in user's Clerk session. */
export function useApi() {
  const { getToken } = useAuth();

  const call = useCallback(
    <T>(method: string, path: string, body?: unknown) => request<T>(getToken, method, path, body),
    [getToken]
  );

  return useMemo(() => ({
    me: () => call<Me>('GET', '/me'),
    dashboard: () => call<Dashboard>('GET', '/dashboard'),

    clients: (p: { search?: string; status?: 'active' | 'archived' | 'all' } = {}) =>
      call<ClientWithStats[]>('GET', `/clients${query(p)}`),
    client: (id: string) => call<Client>('GET', `/clients/${id}`),
    createClient: (input: ClientInput) => call<Client>('POST', '/clients', input),
    updateClient: (id: string, input: ClientInput) => call<Client>('PUT', `/clients/${id}`, input),
    setClientArchived: (id: string, archived: boolean) =>
      call<Client>('POST', `/clients/${id}/${archived ? 'archive' : 'restore'}`),

    documents: (p: { type?: DocumentType; status?: DocumentStatus | 'all'; clientId?: string; search?: string; limit?: number } = {}) =>
      call<DocumentListItem[]>('GET', `/documents${query(p)}`),
    document: (id: string) => call<FullDocument>('GET', `/documents/${id}`),
    createDocument: (input: DocumentCreateInput) => call<Document>('POST', '/documents', input),
    changeStatus: (id: string, action: StatusAction) =>
      call<Document>('POST', `/documents/${id}/status`, { action }),
    sendDocument: (id: string, input: { to?: string; message?: string } = {}) =>
      call<{ recipient: string }>('POST', `/documents/${id}/send`, input),
    shareLink: (id: string) => call<{ url: string }>('POST', `/documents/${id}/share`),
    convertQuote: (id: string) => call<Document>('POST', `/documents/${id}/convert`),
    issueNote: (id: string, input: NoteInput) =>
      call<{ note: Document; invoice: Document }>('POST', `/documents/${id}/notes`, input),

    registerDevice: (input: { token: string; platform: 'ios' | 'android' }) =>
      call<{ registered: true }>('POST', '/devices', input),
    unregisterDevice: (token: string) => call<{ removed: boolean }>('DELETE', '/devices', { token }),

    proofFileUrl: (id: string) => call<{ url: string }>('GET', `/proofs/${id}/file`),
    /**
     * Upload a proof of payment for an invoice (photo or PDF from the phone).
     * `file` is a local URI from the camera, photo library or document picker.
     */
    addProof: async (
      documentId: string,
      file: { uri: string; name: string; type: string }
    ): Promise<PaymentProof> => {
      const token = await getToken();
      const body = new FormData();
      // React Native's FormData accepts a { uri, name, type } file descriptor.
      body.append('file', file as unknown as Blob);
      let res: Response;
      try {
        res = await fetch(`${API_URL}/api/v1/documents/${documentId}/proofs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token ?? ''}` },
          body,
        });
      } catch {
        throw new ApiError("Can't reach InvoiceGen. Check your connection.", 0, 'network');
      }
      const json = (await res.json().catch(() => null)) as { data: { proof: PaymentProof } } | ApiErrorBody | null;
      if (!res.ok || !json || !('data' in json)) {
        const err = json && 'error' in json ? json.error : null;
        throw new ApiError(err?.message ?? 'Upload failed.', res.status, err?.code ?? 'internal', err?.fieldErrors);
      }
      return json.data.proof;
    },
    acceptProof: (id: string, input: { amount: number; paidAt: string; method?: PaymentMethod; reference?: string }) =>
      call<unknown>('POST', `/proofs/${id}/accept`, input),
    rejectProof: (id: string, reason: string) => call<unknown>('POST', `/proofs/${id}/reject`, { reason }),

    payments: (limit = 50) => call<PaymentListItem[]>('GET', `/payments${query({ limit })}`),
    recordPayment: (input: PaymentInput) =>
      call<{ payment: Payment; document: Document }>('POST', '/payments', input),
    recordRefund: (documentId: string, input: RefundInput) =>
      call<{ payment: Payment; document: Document }>('POST', `/documents/${documentId}/refunds`, input),

    /** Download the PDF to the cache (for the share sheet). Returns its file URI. */
    downloadPdf: async (id: string, number: string): Promise<string> => {
      const token = await getToken();
      const dir = new Directory(Paths.cache, 'pdfs');
      if (!dir.exists) dir.create({ intermediates: true });
      const target = new File(dir, `${number.replace(/[^\w.-]/g, '_')}.pdf`);
      try {
        const file = await File.downloadFileAsync(`${API_URL}/api/v1/documents/${id}/pdf`, target, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
          idempotent: true,
        });
        return file.uri;
      } catch {
        throw new ApiError("Couldn't download the PDF. Check your connection.", 0, 'network');
      }
    },
  }), [call, getToken]);
}

export type Api = ReturnType<typeof useApi>;
