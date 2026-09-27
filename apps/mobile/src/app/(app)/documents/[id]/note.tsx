import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, ErrorView, Field, KeyValue, Loading, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { formatCurrency, todayIso } from '@/lib/format';
import { useDocument, useIssueNote } from '@/lib/queries';

/**
 * Issue a credit note (reduce or cancel) or debit note (add to) an issued
 * invoice. Amounts include VAT; the reason is printed on the note.
 */
export default function IssueNoteScreen() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind = kindParam === 'debit' ? 'debit' : 'credit';
  const doc = useDocument(id);
  const issue = useIssueNote(id);

  const [mode, setMode] = useState<'full' | 'amount'>(kind === 'credit' ? 'full' : 'amount');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');

  if (doc.isPending) return <Loading />;
  if (doc.isError) {
    return (
      <Screen>
        <ErrorView message={doc.error.message} onRetry={() => doc.refetch()} />
      </Screen>
    );
  }

  const d = doc.data.document;
  const remaining = Math.round((Number(d.total) + Number(d.adjustmentTotal)) * 100) / 100;
  const label = kind === 'credit' ? 'Credit note' : 'Debit note';
  const parsed = Number(amount.replace(',', '.'));
  const fieldErrors = issue.error instanceof ApiError ? issue.error.fieldErrors : undefined;
  const ready = reason.trim().length >= 3 && (mode === 'full' || parsed > 0);

  function submit() {
    issue.mutate(
      {
        kind,
        reason: reason.trim(),
        mode,
        amount: mode === 'amount' ? parsed : undefined,
        description: description.trim() || undefined,
        issueDate: todayIso(),
      },
      { onSuccess: ({ note }) => router.replace(`/documents/${note.id}`) }
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `${label} for ${d.number}` }} />
      <Screen footer={<Button label={`Issue ${label.toLowerCase()}`} onPress={submit} loading={issue.isPending} disabled={!ready} />}>
        <T muted>
          {kind === 'credit'
            ? `Reduces or cancels ${d.number} without changing the issued invoice.`
            : `Adds an amount to ${d.number}, for example a charge that was left off.`}
        </T>
        {kind === 'credit' ? <KeyValue label="Can be credited" value={formatCurrency(remaining, d.currency)} strong /> : null}

        {kind === 'credit' ? (
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Chip label="Everything (cancel)" selected={mode === 'full'} onPress={() => setMode('full')} />
            <Chip label="Part of it" selected={mode === 'amount'} onPress={() => setMode('amount')} />
          </View>
        ) : null}

        {mode === 'amount' ? (
          <>
            <Field
              label={`Amount incl. ${d.taxLabel ?? 'VAT'} (${d.currency})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              error={fieldErrors?.amount?.[0]}
            />
            <Field
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder={kind === 'credit' ? 'e.g. Discount on logo design' : 'e.g. Extra revision round'}
            />
          </>
        ) : null}

        <Field
          label="Reason (shown on the note)"
          value={reason}
          onChangeText={setReason}
          multiline
          error={fieldErrors?.reason?.[0]}
          placeholder={kind === 'credit' ? 'e.g. Agreed discount; item returned' : 'e.g. Undercharged on the invoice'}
        />

        {issue.isError && !fieldErrors ? <T tone="danger">{issue.error.message}</T> : null}
      </Screen>
    </>
  );
}
