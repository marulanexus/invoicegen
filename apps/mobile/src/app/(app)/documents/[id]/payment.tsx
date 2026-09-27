import type { PaymentMethod } from '@invoicegen/shared/api';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Chip, ErrorView, Field, KeyValue, Loading, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { balanceOf, formatCurrency, PAYMENT_METHOD, todayIso } from '@/lib/format';
import { refundDue } from '@invoicegen/shared/calc';

import { useDocument, useRecordPayment, useRecordRefund, useReviewProof } from '@/lib/queries';

const METHODS: PaymentMethod[] = ['bank_transfer', 'cash', 'card', 'other'];

/**
 * Record a payment. Opened with `?proofId=` (plus the proof's amount, date and
 * reference), it accepts that proof instead, so the payment is linked to it.
 * With `?refund=1` it records money paid back to the client instead.
 */
export default function RecordPaymentScreen() {
  const params = useLocalSearchParams<{
    id: string;
    proofId?: string;
    amount?: string;
    paidOn?: string;
    reference?: string;
    refund?: string;
  }>();
  const { id, proofId } = params;
  const isRefund = params.refund === '1';
  const doc = useDocument(id);
  const record = useRecordPayment(id);
  const accept = useReviewProof(id);
  const recordRefund = useRecordRefund(id);

  // What can be recorded: the balance owed, or for a refund what was overpaid.
  const balance = doc.data ? (isRefund ? refundDue(doc.data.document) : balanceOf(doc.data.document)) : 0;
  const [amount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [paidAt, setPaidAt] = useState(params.paidOn || todayIso());
  const [reference, setReference] = useState(params.reference ?? '');

  if (doc.isPending) return <Loading />;
  if (doc.isError) {
    return (
      <Screen>
        <ErrorView message={doc.error.message} onRetry={() => doc.refetch()} />
      </Screen>
    );
  }

  const d = doc.data.document;
  // Default to what the proof says, but never more than is owed.
  const suggested = params.amount ? Math.min(Number(params.amount), balance) : balance;
  const amountText = amount ?? suggested.toFixed(2);
  const parsedAmount = Number(amountText.replace(',', '.'));
  const mutation = isRefund ? recordRefund : proofId ? accept : record;
  const fieldErrors = mutation.error instanceof ApiError ? mutation.error.fieldErrors : undefined;

  function submit() {
    const common = { amount: parsedAmount, method, paidAt, reference: reference.trim() || undefined };
    if (isRefund) {
      recordRefund.mutate(common, { onSuccess: () => router.back() });
    } else if (proofId) {
      accept.mutate({ id: proofId, action: 'accept', ...common }, { onSuccess: () => router.back() });
    } else {
      record.mutate({ documentId: id, ...common }, { onSuccess: () => router.back() });
    }
  }

  return (
    <Screen
      footer={
        <Button
          label={`${isRefund ? 'Refund' : 'Record'} ${Number.isFinite(parsedAmount) && parsedAmount > 0 ? formatCurrency(parsedAmount, d.currency) : isRefund ? '' : 'payment'}`.trim()}
          onPress={submit}
          loading={mutation.isPending}
          disabled={!(parsedAmount > 0)}
        />
      }>
      {isRefund ? (
        <Stack.Screen options={{ title: 'Record refund' }} />
      ) : proofId ? (
        <Stack.Screen options={{ title: 'Check proof and record' }} />
      ) : null}
      <View style={{ gap: Spacing.one }}>
        <T variant="heading">{d.number}</T>
        <KeyValue label={isRefund ? 'Refund due' : 'Balance due'} value={formatCurrency(balance, d.currency)} strong />
        {proofId ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Badge label="Proof attached" tone="success" />
            <T variant="small" muted>
              Check the money is in your account first.
            </T>
          </View>
        ) : null}
      </View>

      <Field
        label={`Amount (${d.currency})`}
        value={amountText}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        selectTextOnFocus
        error={fieldErrors?.amount?.[0]}
        hint={isRefund ? 'Change this for a part-refund.' : 'Change this for a part-payment.'}
      />

      <Section title={isRefund ? 'How did you pay it back?' : 'How were you paid?'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {METHODS.map((m) => (
            <Chip key={m} label={PAYMENT_METHOD[m]} selected={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>
      </Section>

      <Field
        label={isRefund ? 'Date refunded' : 'Date paid'}
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

      {mutation.isError && !fieldErrors?.amount ? <T tone="danger">{mutation.error.message}</T> : null}
    </Screen>
  );
}
