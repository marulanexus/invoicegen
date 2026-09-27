import { calcDocumentTotals } from '@invoicegen/shared/calc';
import type { DocumentType } from '@invoicegen/shared/api';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ClientPicker } from '@/components/client-picker';
import { Button, Card, Chip, Field, KeyValue, Row, List, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { formatCurrency, todayIso } from '@/lib/format';
import { useClient, useCreateDocument, useMe } from '@/lib/queries';

type Line = { key: number; description: string; quantity: string; unitPrice: string };

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

let nextKey = 1;
const blankLine = (): Line => ({ key: nextKey++, description: '', quantity: '1', unitPrice: '' });

export default function NewDocumentScreen() {
  const params = useLocalSearchParams<{ type?: DocumentType; clientId?: string }>();
  const me = useMe();
  const create = useCreateDocument();
  const preselected = useClient(params.clientId ?? '');

  const [type, setType] = useState<DocumentType>(params.type === 'quote' ? 'quote' : 'invoice');
  const [picked, setPicked] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [notes, setNotes] = useState('');

  const client =
    picked !== undefined ? picked : params.clientId && preselected.data ? { id: preselected.data.id, name: preselected.data.name } : null;

  const business = me.data?.business;
  const currency = business?.defaultCurrency ?? 'ZAR';
  const taxRate = Number(business?.defaultTaxRate ?? 0);
  const taxInclusive = business?.taxInclusive ?? false;
  const filled = lines.filter((l) => l.description.trim() || num(l.unitPrice) !== 0);
  const totals = calcDocumentTotals(
    filled.map((l) => ({ quantity: num(l.quantity), unitPrice: num(l.unitPrice), taxRate })),
    taxInclusive
  );
  const fieldErrors = create.error instanceof ApiError ? create.error.fieldErrors : undefined;

  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function submit() {
    create.mutate(
      {
        type,
        clientId: client?.id ?? null,
        issueDate: todayIso(),
        notes: notes.trim() || undefined,
        lineItems: filled.map((l) => ({
          description: l.description.trim(),
          quantity: num(l.quantity),
          unitPrice: num(l.unitPrice),
        })),
      },
      { onSuccess: (doc) => router.replace(`/documents/${doc.id}`) }
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: type === 'quote' ? 'New quote' : 'New invoice' }} />
      <Screen
        footer={
          <Button
            label={`Create ${type} · ${formatCurrency(totals.total, currency)}`}
            onPress={submit}
            loading={create.isPending}
            disabled={filled.length === 0}
          />
        }>
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          <Chip label="Invoice" selected={type === 'invoice'} onPress={() => setType('invoice')} />
          <Chip label="Quote" selected={type === 'quote'} onPress={() => setType('quote')} />
        </View>

        <Section title="Client">
          <List>
            {[
              <Row
                key="client"
                title={client?.name ?? 'Choose a client'}
                subtitle={client ? 'Tap to change' : 'Optional, but needed to email it'}
                right={<T variant="label" tone="info">{client ? 'Change' : 'Choose'}</T>}
                onPress={() => setPickerOpen(true)}
              />,
            ]}
          </List>
          {fieldErrors?.clientId ? <T tone="danger">{fieldErrors.clientId[0]}</T> : null}
        </Section>

        <Section title="Items">
          {lines.map((l, i) => (
            <Card key={l.key}>
              <Field
                label={`Item ${i + 1}`}
                value={l.description}
                onChangeText={(v) => update(l.key, { description: v })}
                placeholder="What you're charging for"
              />
              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                <View style={{ flex: 1 }}>
                  <Field label="Qty" value={l.quantity} onChangeText={(v) => update(l.key, { quantity: v })} keyboardType="decimal-pad" selectTextOnFocus />
                </View>
                <View style={{ flex: 2 }}>
                  <Field
                    label={`Price (${currency})`}
                    value={l.unitPrice}
                    onChangeText={(v) => update(l.key, { unitPrice: v })}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
              </View>
              {lines.length > 1 ? (
                <Button label="Remove item" variant="ghost" onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
              ) : null}
            </Card>
          ))}
          <Button label="Add another item" variant="secondary" onPress={() => setLines((ls) => [...ls, blankLine()])} />
          {fieldErrors?.lineItems ? <T tone="danger">{fieldErrors.lineItems[0]}</T> : null}
        </Section>

        <Card>
          <KeyValue label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
          {taxRate > 0 ? (
            <KeyValue
              label={`${business?.taxLabel ?? 'Tax'} ${taxRate}%${taxInclusive ? ' (included)' : ''}`}
              value={formatCurrency(totals.taxTotal, currency)}
            />
          ) : null}
          <KeyValue label="Total" value={formatCurrency(totals.total, currency)} strong />
        </Card>

        <Field label="Note to client (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Leave blank to use your usual note" />

        {create.isError && !fieldErrors ? <T tone="danger">{create.error.message}</T> : null}
      </Screen>

      <ClientPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(c) => {
          setPicked(c ? { id: c.id, name: c.name } : null);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
