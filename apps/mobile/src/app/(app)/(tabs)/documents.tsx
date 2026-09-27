import type { DocumentStatus, DocumentType } from '@invoicegen/shared/api';
import { router } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { View } from 'react-native';

import { TabHeader } from '@/components/tab-header';
import { Badge, Button, Chip, ChipRow, Empty, ErrorView, Field, List, Loading, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatCurrency, formatDate, STATUS } from '@/lib/format';
import { useDocuments } from '@/lib/queries';

const TYPES: { value: DocumentType; label: string }[] = [
  { value: 'invoice', label: 'Invoices' },
  { value: 'quote', label: 'Quotes' },
  { value: 'receipt', label: 'Receipts' },
];

const FILTERS: Record<DocumentType, { value: DocumentStatus | 'all'; label: string }[]> = {
  invoice: [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'partial', label: 'Part paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'paid', label: 'Paid' },
  ],
  quote: [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'declined', label: 'Declined' },
  ],
  receipt: [{ value: 'all', label: 'All' }],
};

export default function DocumentsScreen() {
  const [type, setType] = useState<DocumentType>('invoice');
  const [status, setStatus] = useState<DocumentStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const docs = useDocuments({ type, status, search: deferredSearch || undefined });

  return (
    <View style={{ flex: 1 }}>
      <TabHeader
        title="Documents"
        right={
          <Button
            label={`New ${type}`}
            onPress={() => router.push(`/documents/new?type=${type === 'receipt' ? 'invoice' : type}`)}
          />
        }
      />
      <View style={{ paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two }}>
        <ChipRow>
          {TYPES.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              selected={type === t.value}
              onPress={() => {
                setType(t.value);
                setStatus('all');
              }}
            />
          ))}
        </ChipRow>
        {FILTERS[type].length > 1 ? (
          <ChipRow>
            {FILTERS[type].map((f) => (
              <Chip key={f.value} label={f.label} selected={status === f.value} onPress={() => setStatus(f.value)} />
            ))}
          </ChipRow>
        ) : null}
        <Field
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Number or client name"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {docs.isPending ? (
        <Loading />
      ) : (
        <Screen refreshing={docs.isRefetching} onRefresh={() => docs.refetch()}>
          {docs.isError ? <ErrorView message={docs.error.message} onRetry={() => docs.refetch()} /> : null}
          {docs.data && docs.data.length === 0 ? (
            <Empty
              title={deferredSearch || status !== 'all' ? 'No matches' : `No ${type}s yet`}
              message={deferredSearch || status !== 'all' ? 'Try a different filter or search.' : undefined}
            />
          ) : null}
          {docs.data && docs.data.length > 0 ? (
            <List>
              {docs.data.map((d) => (
                <Row
                  key={d.id}
                  title={d.clientName ?? 'No client'}
                  subtitle={`${d.number} · ${formatDate(d.issueDate)}`}
                  right={formatCurrency(d.total, d.currency)}
                  rightSub={<Badge label={STATUS[d.status].label} tone={STATUS[d.status].tone} />}
                  onPress={() => router.push(`/documents/${d.id}`)}
                />
              ))}
            </List>
          ) : null}
        </Screen>
      )}
    </View>
  );
}
