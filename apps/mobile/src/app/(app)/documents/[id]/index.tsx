import type { FullDocument, StatusAction } from '@invoicegen/shared/api';
import * as Sharing from 'expo-sharing';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Badge, Button, Card, ErrorView, KeyValue, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, useApi } from '@/lib/api';
import { balanceOf, formatCurrency, formatDate, PAYMENT_METHOD, STATUS } from '@/lib/format';
import { useChangeStatus, useConvertQuote, useDocument, useMe, useSendDocument } from '@/lib/queries';
import { shareMessage } from '@/lib/share';

const TYPE_LABEL = { invoice: 'Invoice', quote: 'Quote', receipt: 'Receipt' } as const;

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

/** Status changes that make sense right now (mirrors the server's rules). */
function availableActions(doc: FullDocument['document']): { action: StatusAction; label: string; destructive?: boolean }[] {
  const actions: { action: StatusAction; label: string; destructive?: boolean }[] = [];
  if (doc.status === 'draft') actions.push({ action: 'send', label: 'Mark as sent' });
  if (doc.type !== 'quote' && doc.status !== 'paid' && doc.status !== 'void') actions.push({ action: 'mark_paid', label: 'Mark as paid in full' });
  if (doc.type === 'quote') {
    actions.push({ action: 'accept', label: 'Mark accepted' });
    actions.push({ action: 'decline', label: 'Mark declined' });
  }
  if (doc.status !== 'draft') actions.push({ action: 'reopen', label: 'Reopen as draft' });
  if (doc.status !== 'void') actions.push({ action: 'void', label: 'Void', destructive: true });
  return actions;
}

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const api = useApi();
  const me = useMe();
  const doc = useDocument(id);
  const changeStatus = useChangeStatus(id);
  const send = useSendDocument(id);
  const convert = useConvertQuote(id);
  const [busy, setBusy] = useState<'whatsapp' | 'pdf' | null>(null);

  if (doc.isPending) return <Loading />;
  if (doc.isError) {
    return (
      <Screen>
        <ErrorView message={doc.error.message} onRetry={() => doc.refetch()} />
      </Screen>
    );
  }

  const { document: d, client, items, payments, taxInvoice } = doc.data;
  const heading = taxInvoice.heading.charAt(0) + taxInvoice.heading.slice(1).toLowerCase();
  const balance = balanceOf(d);
  const money = (v: string | number) => formatCurrency(v, d.currency);
  const business = me.data?.business?.displayName ?? '';
  const canTakePayment = d.type === 'invoice' && balance > 0 && d.status !== 'void';

  async function shareOnWhatsApp() {
    setBusy('whatsapp');
    try {
      const { url } = await api.shareLink(id);
      const lines = [
        `Hi${client?.name ? ` ${client.name}` : ''},`,
        `here is ${TYPE_LABEL[d.type].toLowerCase()} ${d.number}${business ? ` from ${business}` : ''} for ${money(d.total)}${d.dueDate && d.type === 'invoice' ? `, due ${formatDate(d.dueDate)}` : ''}.`,
        d.type === 'invoice' ? `View and pay here: ${url}` : `View it here: ${url}`,
      ];
      await shareMessage(lines.join('\n'), client?.phone);
      doc.refetch();
    } catch (err) {
      Alert.alert("Couldn't share", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    setBusy('pdf');
    try {
      const uri = await api.downloadPdf(id, d.number);
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: d.number });
    } catch (err) {
      Alert.alert("Couldn't share the PDF", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function emailToClient() {
    const to = client?.email;
    if (!to) {
      Alert.alert('No email address', 'Add an email address to this client first, or share on WhatsApp instead.');
      return;
    }
    Alert.alert(`Email ${d.number}?`, `The PDF goes to ${to}${d.status === 'draft' ? ' and it will be marked as sent' : ''}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: () =>
          send.mutate(
            {},
            {
              onSuccess: (r) => Alert.alert('Sent', `Emailed to ${r.recipient}.`),
              onError: (err) => Alert.alert("Couldn't send", errorMessage(err)),
            }
          ),
      },
    ]);
  }

  function runStatus(action: StatusAction, label: string, destructive?: boolean) {
    const go = () =>
      changeStatus.mutate(action, { onError: (err) => Alert.alert(`Couldn't ${label.toLowerCase()}`, errorMessage(err)) });
    if (destructive || action === 'mark_paid') {
      Alert.alert(
        `${label}?`,
        action === 'mark_paid' ? `This records a payment of ${money(balance)} for the balance.` : 'You can reopen it later.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: label, style: destructive ? 'destructive' : 'default', onPress: go },
        ]
      );
    } else {
      go();
    }
  }

  function convertToInvoice() {
    convert.mutate(undefined, {
      onSuccess: (inv) => router.replace(`/documents/${inv.id}`),
      onError: (err) => Alert.alert("Couldn't convert", errorMessage(err)),
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: d.number }} />
      <Screen refreshing={doc.isRefetching} onRefresh={() => doc.refetch()}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T variant="small" muted>
              {heading} · {formatDate(d.issueDate)}
            </T>
            <Badge label={STATUS[d.status].label} tone={STATUS[d.status].tone} />
          </View>
          <T variant="heading">{client?.name ?? d.billToSnapshot?.name ?? 'No client'}</T>
          <T variant="amount">{money(d.total)}</T>
          {d.type === 'invoice' ? (
            <View style={{ gap: Spacing.one }}>
              <KeyValue label="Paid" value={money(d.amountPaid)} />
              <KeyValue label="Balance due" value={money(balance)} strong />
              {d.dueDate ? <KeyValue label="Due" value={formatDate(d.dueDate)} /> : null}
            </View>
          ) : d.validUntil ? (
            <KeyValue label="Valid until" value={formatDate(d.validUntil)} />
          ) : null}
        </Card>

        {d.status === 'draft' && taxInvoice.problems.length > 0 ? (
          <Card style={{ borderColor: theme.warning }}>
            <T variant="heading" tone="warning">
              Fix before sending
            </T>
            <T variant="small" muted>
              SARS tax invoice rules
            </T>
            {taxInvoice.problems.map((p) => (
              <T key={p.code}>• {p.message}</T>
            ))}
            {taxInvoice.problems.some((p) => p.fix === 'client') && client ? (
              <Button label="Edit client" variant="secondary" onPress={() => router.push(`/clients/new?id=${client.id}`)} />
            ) : null}
            {taxInvoice.problems.some((p) => p.fix === 'settings') ? (
              <T variant="small" muted>
                Business details and VAT settings are on the InvoiceGen website under Settings.
              </T>
            ) : null}
          </Card>
        ) : null}

        <View style={{ gap: Spacing.two }}>
          <Button label="Share on WhatsApp" onPress={shareOnWhatsApp} loading={busy === 'whatsapp'} disabled={busy !== null} />
          {canTakePayment ? (
            <Button label="Record a payment" variant="secondary" onPress={() => router.push(`/documents/${id}/payment`)} />
          ) : null}
          {d.type === 'quote' && d.status !== 'declined' && d.status !== 'void' ? (
            <Button label="Convert to invoice" variant="secondary" onPress={convertToInvoice} loading={convert.isPending} />
          ) : null}
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button label="Share PDF" variant="secondary" style={{ flex: 1 }} onPress={sharePdf} loading={busy === 'pdf'} disabled={busy !== null} />
            <Button label="Email" variant="secondary" style={{ flex: 1 }} onPress={emailToClient} loading={send.isPending} />
          </View>
        </View>

        <Section title="Items">
          <Card>
            {items.map((li) => (
              <View key={li.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three }}>
                <View style={{ flex: 1 }}>
                  <T>{li.description || 'Item'}</T>
                  <T variant="small" muted>
                    {Number(li.quantity)} × {money(li.unitPrice)}
                    {Number(li.discountRate) > 0 ? ` · −${Number(li.discountRate)}%` : ''}
                    {Number(li.taxRate) > 0 ? ` · ${d.taxLabel ?? 'Tax'} ${Number(li.taxRate)}%` : ''}
                  </T>
                </View>
                <T variant="label">{money(li.amount)}</T>
              </View>
            ))}
            <View style={{ gap: Spacing.one, marginTop: Spacing.two }}>
              <KeyValue label="Subtotal" value={money(d.subtotal)} />
              {Number(d.taxTotal) > 0 ? <KeyValue label={d.taxLabel ?? 'Tax'} value={money(d.taxTotal)} /> : null}
              <KeyValue label="Total" value={money(d.total)} strong />
            </View>
          </Card>
        </Section>

        {payments.length > 0 ? (
          <Section title="Payments">
            <List>
              {payments.map((p) => (
                <Row
                  key={p.id}
                  title={money(p.amount)}
                  subtitle={[PAYMENT_METHOD[p.method], formatDate(p.paidAt), p.reference].filter(Boolean).join(' · ')}
                />
              ))}
            </List>
          </Section>
        ) : null}

        <Section title="More">
          <View style={{ gap: Spacing.two }}>
            {availableActions(d).map((a) => (
              <Button
                key={a.action}
                label={a.label}
                variant={a.destructive ? 'danger' : 'secondary'}
                onPress={() => runStatus(a.action, a.label, a.destructive)}
                disabled={changeStatus.isPending}
              />
            ))}
          </View>
        </Section>
      </Screen>
    </>
  );
}
