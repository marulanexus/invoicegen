import type { FullDocument, PaymentProof, StatusAction } from '@invoicegen/shared/api';
import * as WebBrowser from 'expo-web-browser';
import { shareMessage } from '@invoicegen/shared/whatsapp';
import * as Sharing from 'expo-sharing';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Badge, Button, Card, ErrorView, KeyValue, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, useApi } from '@/lib/api';
import { balanceOf, formatCurrency, formatDate, PAYMENT_METHOD, STATUS } from '@/lib/format';
import { useAddProof, useChangeStatus, useConvertQuote, useDocument, useMe, useReviewProof, useSendDocument } from '@/lib/queries';
import { pickProof, type ProofSource } from '@/lib/proof-picker';
import { sendViaWhatsApp } from '@/lib/share';

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

/** Status changes that make sense right now (mirrors the server's rules). */
function availableActions(doc: FullDocument['document'], locked: boolean): { action: StatusAction; label: string; destructive?: boolean }[] {
  const actions: { action: StatusAction; label: string; destructive?: boolean }[] = [];
  // Notes are final; issued tax invoices are corrected with notes, not reopened or voided.
  if (doc.type === 'credit_note' || doc.type === 'debit_note') return actions;
  if (doc.status === 'draft') actions.push({ action: 'send', label: 'Mark as sent' });
  if (doc.type !== 'quote' && doc.status !== 'paid' && doc.status !== 'void') actions.push({ action: 'mark_paid', label: 'Mark as paid in full' });
  if (doc.type === 'quote') {
    actions.push({ action: 'accept', label: 'Mark accepted' });
    actions.push({ action: 'decline', label: 'Mark declined' });
  }
  if (doc.status !== 'draft' && !locked) actions.push({ action: 'reopen', label: 'Reopen as draft' });
  if (doc.status !== 'void' && !locked) actions.push({ action: 'void', label: 'Void', destructive: true });
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
  const reviewProof = useReviewProof(id);
  const addProofMutation = useAddProof(id);
  const [busy, setBusy] = useState<'whatsapp' | 'pdf' | null>(null);

  if (doc.isPending) return <Loading />;
  if (doc.isError) {
    return (
      <Screen>
        <ErrorView message={doc.error.message} onRetry={() => doc.refetch()} />
      </Screen>
    );
  }

  const { document: d, client, items, payments, taxInvoice, related, notes, proofs } = doc.data;
  const isNote = d.type === 'credit_note' || d.type === 'debit_note';
  const adjustment = Number(d.adjustmentTotal);
  const canIssueNotes = d.type === 'invoice' && d.status !== 'draft' && d.status !== 'void';
  const heading = taxInvoice.heading.charAt(0) + taxInvoice.heading.slice(1).toLowerCase();
  const balance = balanceOf(d);
  const canAddProof = canIssueNotes && balance > 0;
  const money = (v: string | number) => formatCurrency(v, d.currency);
  const business = me.data?.business?.displayName ?? '';
  const canTakePayment = d.type === 'invoice' && balance > 0 && d.status !== 'void';

  async function shareOnWhatsApp() {
    setBusy('whatsapp');
    try {
      const { url } = await api.shareLink(id);
      const message = shareMessage({
        type: d.type,
        number: d.number,
        total: money(d.total),
        url,
        businessName: business,
        clientName: client?.name,
        dueDate: d.dueDate ? formatDate(d.dueDate) : null,
      });
      await sendViaWhatsApp(message, client?.phone);
      doc.refetch();
    } catch (err) {
      Alert.alert("Couldn't share", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function viewProof(proofId: string) {
    try {
      const { url } = await api.proofFileUrl(proofId);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      Alert.alert("Couldn't open the proof", errorMessage(err));
    }
  }

  /** Review on the payment screen, pre-filled from the proof (the owner can adjust part-payments). */
  function acceptProof(p: Pick<PaymentProof, 'id' | 'amount' | 'paidOn' | 'reference'>) {
    const params = new URLSearchParams({ proofId: p.id });
    if (p.amount) params.set('amount', p.amount);
    if (p.paidOn) params.set('paidOn', p.paidOn);
    if (p.reference) params.set('reference', p.reference);
    router.push(`/documents/${id}/payment?${params.toString()}`);
  }

  async function addProof(source: ProofSource) {
    const picked = await pickProof(source);
    if (!picked.ok) {
      if (picked.reason !== 'cancelled') Alert.alert("Couldn't add the proof", picked.message);
      return;
    }
    addProofMutation.mutate(picked.file, {
      onSuccess: (proof) => acceptProof(proof),
      onError: (err) => Alert.alert("Couldn't upload the proof", errorMessage(err)),
    });
  }

  function rejectProof(p: PaymentProof) {
    const reject = (reason: string) =>
      reviewProof.mutate({ id: p.id, action: 'reject', reason }, { onError: (err) => Alert.alert("Couldn't reject it", errorMessage(err)) });
    // Android alerts can't take typed input: offer the common reasons.
    Alert.alert('Reject this proof?', undefined, [
      { text: "Money hasn't arrived", onPress: () => reject("Money hasn't arrived") },
      { text: 'Wrong invoice or amount', onPress: () => reject('Wrong invoice or amount') },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
          {isNote && related ? (
            <View style={{ gap: Spacing.one }}>
              <KeyValue label="For invoice" value={related.number} />
              {d.reason ? <KeyValue label="Reason" value={d.reason} /> : null}
              <Button label={`Open ${related.number}`} variant="ghost" onPress={() => router.push(`/documents/${related.id}`)} />
            </View>
          ) : null}
          {d.type === 'invoice' ? (
            <View style={{ gap: Spacing.one }}>
              {adjustment !== 0 ? (
                <KeyValue label="Credit/debit notes" value={`${adjustment < 0 ? '−' : '+'}${money(Math.abs(adjustment))}`} />
              ) : null}
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

        {proofs.length > 0 || canAddProof ? (
          <Section title="Proof of payment">
            {canAddProof ? (
              <Card>
                <T variant="small" muted>
                  Got proof from the client on WhatsApp or email? Add it here, then record the payment.
                </T>
                <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                  <Button label="Camera" variant="secondary" style={{ flex: 1 }} onPress={() => addProof('camera')} disabled={addProofMutation.isPending} />
                  <Button label="Photos" variant="secondary" style={{ flex: 1 }} onPress={() => addProof('photos')} disabled={addProofMutation.isPending} />
                  <Button label="PDF" variant="secondary" style={{ flex: 1 }} onPress={() => addProof('pdf')} disabled={addProofMutation.isPending} />
                </View>
                {addProofMutation.isPending ? <T variant="small" muted>Uploading…</T> : null}
              </Card>
            ) : null}
            {proofs.map((p) => (
              <Card key={p.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T variant="heading">{p.amount ? money(p.amount) : 'Amount not given'}</T>
                  <Badge
                    label={p.status === 'pending' ? 'To check' : p.status === 'accepted' ? 'Accepted' : 'Rejected'}
                    tone={p.status === 'pending' ? 'warning' : p.status === 'accepted' ? 'success' : 'neutral'}
                  />
                </View>
                <T variant="small" muted>
                  {[p.uploadedByMemberId ? 'Added by you' : 'From the client', p.paidOn ? `Paid ${formatDate(p.paidOn)}` : null, p.reference ? `Ref ${p.reference}` : null, `Sent ${formatDate(p.createdAt)}`]
                    .filter(Boolean)
                    .join(' · ')}
                </T>
                {p.status === 'rejected' && p.rejectionReason ? <T variant="small" muted>Rejected: {p.rejectionReason}</T> : null}
                <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                  <Button label="View" variant="secondary" style={{ flex: 1 }} onPress={() => viewProof(p.id)} />
                  {p.status === 'pending' ? (
                    <>
                      <Button label="Accept" style={{ flex: 1 }} onPress={() => acceptProof(p)} disabled={reviewProof.isPending || balance <= 0} />
                      <Button label="Reject" variant="ghost" style={{ flex: 1 }} onPress={() => rejectProof(p)} disabled={reviewProof.isPending} />
                    </>
                  ) : null}
                </View>
              </Card>
            ))}
          </Section>
        ) : null}

        {canIssueNotes ? (
          <Section title="Credit & debit notes">
            {notes.length > 0 ? (
              <List>
                {notes.map((n) => (
                  <Row
                    key={n.id}
                    title={n.number}
                    subtitle={n.reason ?? undefined}
                    right={`${n.type === 'credit_note' ? '−' : '+'}${money(n.total)}`}
                    onPress={() => router.push(`/documents/${n.id}`)}
                  />
                ))}
              </List>
            ) : taxInvoice.locked ? (
              <T variant="small" muted>
                This tax invoice is issued, so it can&apos;t be edited. Correct or cancel it with a note.
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              {Number(d.total) + adjustment > 0 ? (
                <Button label="Credit note" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/documents/${id}/note?kind=credit`)} />
              ) : null}
              <Button label="Debit note" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/documents/${id}/note?kind=debit`)} />
            </View>
          </Section>
        ) : null}

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

        {!isNote ? (
        <Section title="More">
          <View style={{ gap: Spacing.two }}>
            {availableActions(d, taxInvoice.locked).map((a) => (
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
        ) : null}
      </Screen>
    </>
  );
}
