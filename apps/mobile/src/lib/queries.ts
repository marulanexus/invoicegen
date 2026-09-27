import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClientInput,
  DocumentCreateInput,
  DocumentStatus,
  DocumentType,
  PaymentInput,
  StatusAction,
} from '@invoicegen/shared/api';

import { useApi } from '@/lib/api';

/**
 * Server state for every screen. Data is refetched when a screen mounts or the
 * app returns to the foreground; after any change we invalidate everything the
 * change can affect, so web and phone always show the same numbers.
 */

export const keys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  documents: (p: object = {}) => ['documents', p] as const,
  document: (id: string) => ['document', id] as const,
  clients: (p: object = {}) => ['clients', p] as const,
  client: (id: string) => ['client', id] as const,
};

export function useMe() {
  const api = useApi();
  return useQuery({ queryKey: keys.me, queryFn: api.me, staleTime: 5 * 60_000 });
}

export function useDashboard() {
  const api = useApi();
  return useQuery({ queryKey: keys.dashboard, queryFn: api.dashboard });
}

export function useDocuments(p: { type?: DocumentType; status?: DocumentStatus | 'all'; clientId?: string; search?: string } = {}) {
  const api = useApi();
  return useQuery({ queryKey: keys.documents(p), queryFn: () => api.documents({ ...p, limit: 100 }) });
}

export function useDocument(id: string) {
  const api = useApi();
  return useQuery({ queryKey: keys.document(id), queryFn: () => api.document(id) });
}

export function useClients(p: { search?: string; status?: 'active' | 'archived' | 'all' } = {}) {
  const api = useApi();
  return useQuery({ queryKey: keys.clients(p), queryFn: () => api.clients(p) });
}

export function useClient(id: string) {
  const api = useApi();
  return useQuery({ queryKey: keys.client(id), queryFn: () => api.client(id), enabled: Boolean(id) });
}

/** After a document or payment changes: lists, totals and that document. */
function useInvalidateMoney() {
  const qc = useQueryClient();
  return (documentId?: string) => {
    qc.invalidateQueries({ queryKey: ['documents'] });
    qc.invalidateQueries({ queryKey: ['clients'] });
    qc.invalidateQueries({ queryKey: keys.dashboard });
    if (documentId) qc.invalidateQueries({ queryKey: keys.document(documentId) });
  };
}

export function useCreateDocument() {
  const api = useApi();
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: DocumentCreateInput) => api.createDocument(input),
    onSuccess: () => invalidate(),
  });
}

export function useChangeStatus(id: string) {
  const api = useApi();
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (action: StatusAction) => api.changeStatus(id, action),
    onSuccess: () => invalidate(id),
  });
}

export function useSendDocument(id: string) {
  const api = useApi();
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: { to?: string } = {}) => api.sendDocument(id, input),
    onSuccess: () => invalidate(id),
  });
}

export function useConvertQuote(id: string) {
  const api = useApi();
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: () => api.convertQuote(id),
    onSuccess: () => invalidate(id),
  });
}

export function useRecordPayment(documentId: string) {
  const api = useApi();
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: PaymentInput) => api.recordPayment(input),
    onSuccess: () => invalidate(documentId),
  });
}

export function useSaveClient(id?: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => (id ? api.updateClient(id, input) : api.createClient(input)),
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.setQueryData(keys.client(client.id), client);
    },
  });
}

export function useSetClientArchived(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => api.setClientArchived(id, archived),
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.setQueryData(keys.client(id), client);
      qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}
