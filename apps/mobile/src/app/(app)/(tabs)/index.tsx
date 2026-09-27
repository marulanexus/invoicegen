import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { TabHeader } from '@/components/tab-header';
import { Badge, Button, Card, Empty, ErrorView, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatCurrency, formatDate, STATUS } from '@/lib/format';
import { useDashboard, useMe } from '@/lib/queries';
import { queryClient } from '@/lib/query-client';

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'success' }) {
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <T variant="small" muted>
        {label}
      </T>
      <T variant="amount" tone={tone} numberOfLines={1}>
        {value}
      </T>
    </Card>
  );
}

export default function HomeScreen() {
  const { signOut } = useAuth();
  const me = useMe();
  const dash = useDashboard();
  const currency = dash.data?.currency ?? me.data?.business?.defaultCurrency ?? 'ZAR';
  const money = (n: number) => formatCurrency(n, currency);

  function confirmSignOut() {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          queryClient.clear();
          signOut();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <TabHeader
        subtitle="Welcome back"
        title={me.data?.business?.displayName ?? 'InvoiceGen'}
        right={<Button label="Sign out" variant="ghost" onPress={confirmSignOut} />}
      />
      {dash.isPending ? (
        <Loading />
      ) : (
        <Screen refreshing={dash.isRefetching} onRefresh={() => dash.refetch()}>
          {dash.isError ? <ErrorView message={dash.error.message} onRetry={() => dash.refetch()} /> : null}

          {dash.data ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three }}>
                <Metric label="Owed to you" value={money(dash.data.metrics.outstanding)} />
                <Metric
                  label="Overdue"
                  value={money(dash.data.metrics.overdue)}
                  tone={dash.data.metrics.overdue > 0 ? 'danger' : undefined}
                />
                <Metric label="Received" value={money(dash.data.metrics.totalRevenue)} tone="success" />
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.three }}>
                <Button label="New invoice" style={{ flex: 1 }} onPress={() => router.push('/documents/new?type=invoice')} />
                <Button
                  label="New quote"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => router.push('/documents/new?type=quote')}
                />
              </View>

              <Section title="Due soon">
                {dash.data.dueSoon.length === 0 ? (
                  <Empty title="Nothing due this week" message="Invoices due in the next 7 days, or overdue, show here." />
                ) : (
                  <List>
                    {dash.data.dueSoon.map((d) => (
                      <Row
                        key={d.id}
                        title={d.clientName ?? d.number}
                        subtitle={`${d.number} · ${d.overdue ? 'was due' : 'due'} ${formatDate(d.dueDate)}`}
                        right={formatCurrency(d.balance, d.currency)}
                        rightSub={d.overdue ? <Badge label="Overdue" tone="danger" /> : null}
                        onPress={() => router.push(`/documents/${d.id}`)}
                      />
                    ))}
                  </List>
                )}
              </Section>

              <Section title="Recent">
                {dash.data.recentDocuments.length === 0 ? (
                  <Empty title="No invoices yet" message="Create your first invoice and share it on WhatsApp." />
                ) : (
                  <List>
                    {dash.data.recentDocuments.map((d) => (
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
                )}
              </Section>
            </>
          ) : null}
        </Screen>
      )}
    </View>
  );
}
