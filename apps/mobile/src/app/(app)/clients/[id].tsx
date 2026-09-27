import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, View } from 'react-native';

import { Badge, Button, Card, Empty, ErrorView, KeyValue, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatCurrency, formatDate, STATUS } from '@/lib/format';
import { useClient, useDocuments, useSetClientArchived } from '@/lib/queries';
import { whatsappNumber } from '@/lib/share';

export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useClient(id);
  const docs = useDocuments({ clientId: id });
  const archive = useSetClientArchived(id);

  if (client.isPending) return <Loading />;
  if (client.isError) {
    return (
      <Screen>
        <ErrorView message={client.error.message} onRetry={() => client.refetch()} />
      </Screen>
    );
  }

  const c = client.data;
  const wa = whatsappNumber(c.phone);
  const owed = (docs.data ?? [])
    .filter((d) => d.type === 'invoice' && ['sent', 'viewed', 'partial', 'overdue'].includes(d.status))
    .reduce((sum, d) => sum + Number(d.total) - Number(d.amountPaid), 0);
  const address = [c.addressLine1, c.city, c.postalCode].filter(Boolean).join(', ');

  function toggleArchive() {
    const archiving = c.status === 'active';
    Alert.alert(archiving ? `Archive ${c.name}?` : `Restore ${c.name}?`, archiving ? 'Their invoices stay; they just leave your client list.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: archiving ? 'Archive' : 'Restore', style: archiving ? 'destructive' : 'default', onPress: () => archive.mutate(archiving) },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: c.name,
          headerRight: () => <Button label="Edit" variant="ghost" onPress={() => router.push(`/clients/new?id=${c.id}`)} />,
        }}
      />
      <Screen refreshing={client.isRefetching || docs.isRefetching} onRefresh={() => { client.refetch(); docs.refetch(); }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T variant="heading">{c.name}</T>
            {c.status === 'archived' ? <Badge label="Archived" tone="neutral" /> : null}
          </View>
          {c.companyName ? <T muted>{c.companyName}</T> : null}
          {address ? <T variant="small" muted>{address}</T> : null}
          {c.taxId ? <KeyValue label="VAT number" value={c.taxId} /> : null}
          <KeyValue label="Owes you" value={formatCurrency(owed, c.currency ?? 'ZAR')} strong />
        </Card>

        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          {wa ? <Button label="WhatsApp" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`https://wa.me/${wa}`)} /> : null}
          {c.phone ? <Button label="Call" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${c.phone}`)} /> : null}
          {c.email ? <Button label="Email" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`mailto:${c.email}`)} /> : null}
        </View>

        <Button label="New invoice for this client" onPress={() => router.push(`/documents/new?type=invoice&clientId=${c.id}`)} />

        <Section title="Documents">
          {docs.isPending ? (
            <Loading />
          ) : docs.data && docs.data.length > 0 ? (
            <List>
              {docs.data.map((d) => (
                <Row
                  key={d.id}
                  title={d.number}
                  subtitle={formatDate(d.issueDate)}
                  right={formatCurrency(d.total, d.currency)}
                  rightSub={<Badge label={STATUS[d.status].label} tone={STATUS[d.status].tone} />}
                  onPress={() => router.push(`/documents/${d.id}`)}
                />
              ))}
            </List>
          ) : (
            <Empty title="No documents yet" />
          )}
        </Section>

        <Button
          label={c.status === 'active' ? 'Archive client' : 'Restore client'}
          variant={c.status === 'active' ? 'danger' : 'secondary'}
          onPress={toggleArchive}
          loading={archive.isPending}
        />
      </Screen>
    </>
  );
}
