import type { PaymentMethod } from '@invoicegen/shared/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, ErrorView, Field, KeyValue, Loading, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { balanceOf, formatCurrency, PAYMENT_METHOD, todayIso } from '@/lib/format';
import { useDocument, useRecordPayment } from '@/lib/queries';

const METHODS: PaymentMethod[] = ['bank_transfer', 'cash', 'card', 'other'];

export default function RecordPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doc = useDocument(id);
  const record = useRecordPayment(id);

  const balance = doc.data ? balanceOf(doc.data.document) : 0;
  const [amount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [paidAt, setPaidAt] = useState(todayIso());
  const [reference, setReference] = useState('');

  if (doc.isPending) return <Loading />;
  if (doc.isError) {
    return (
      <Screen>
        <ErrorView message={doc.error.message} onRetry={() => doc.refetch()} />
      </Screen>
    );
  }

  const d = doc.data.document;
  const amountText = amount ?? balance.toFixed(2);
  const parsedAmount = Number(amountText.replace(',', '.'));
  const fieldErrors = record.error instanceof ApiError ? record.error.fieldErrors : undefined;

  function submit() {
    record.mutate(
      { documentId: id, amount: parsedAmount, method, paidAt, reference: reference.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={`Record ${Number.isFinite(parsedAmount) && parsedAmount > 0 ? formatCurrency(parsedAmount, d.currency) : 'payment'}`}
          onPress={submit}
          loading={record.isPending}
          disabled={!(parsedAmount > 0)}
        />
      }>
      <View style={{ gap: Spacing.one }}>
        <T variant="heading">{d.number}</T>
        <KeyValue label="Balance due" value={formatCurrency(balance, d.currency)} strong />
      </View>

      <Field
        label={`Amount (${d.currency})`}
        value={amountText}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        selectTextOnFocus
        error={fieldErrors?.amount?.[0]}
        hint="Change this for a part-payment."
      />

      <Section title="How were you paid?">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {METHODS.map((m) => (
            <Chip key={m} label={PAYMENT_METHOD[m]} selected={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>
      </Section>

      <Field
        label="Date paid"
        value={paidAt}
        onChangeText={setPaidAt}
        placeholder="YYYY-MM-DD"
        autoCorrect={false}
        error={fieldErrors?.paidAt?.[0]}
      />
      <Field
        label="Reference (optional)"
        value={reference}
        onChangeText={setReference}
        placeholder="e.g. bank reference on the proof of payment"
      />

      {record.isError && !fieldErrors?.amount ? (
        <T tone="danger">{record.error.message}</T>
      ) : null}
    </Screen>
  );
}
