import { router } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { View } from 'react-native';

import { TabHeader } from '@/components/tab-header';
import { Button, Empty, ErrorView, Field, List, Loading, Row, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format';
import { useClients, useMe } from '@/lib/queries';

export default function ClientsScreen() {
  const me = useMe();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const clients = useClients({ search: deferredSearch || undefined, status: 'active' });
  const currency = me.data?.business?.defaultCurrency ?? 'ZAR';

  return (
    <View style={{ flex: 1 }}>
      <TabHeader title="Clients" right={<Button label="Add client" onPress={() => router.push('/clients/new')} />} />
      <View style={{ paddingHorizontal: Spacing.three, paddingBottom: Spacing.two }}>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name, company or email" autoCorrect={false} />
      </View>

      {clients.isPending ? (
        <Loading />
      ) : (
        <Screen refreshing={clients.isRefetching} onRefresh={() => clients.refetch()}>
          {clients.isError ? <ErrorView message={clients.error.message} onRetry={() => clients.refetch()} /> : null}
          {clients.data && clients.data.length === 0 ? (
            <Empty
              title={deferredSearch ? 'No matches' : 'No clients yet'}
              message={deferredSearch ? undefined : 'Add the people and businesses you invoice.'}
            />
          ) : null}
          {clients.data && clients.data.length > 0 ? (
            <List>
              {clients.data.map((c) => (
                <Row
                  key={c.id}
                  title={c.name}
                  subtitle={[c.companyName, c.email ?? c.phone].filter(Boolean).join(' · ') || undefined}
                  right={
                    c.stats.outstanding > 0 ? (
                      <T variant="label" tone="warning">
                        {formatCurrency(c.stats.outstanding, c.currency ?? currency)}
                      </T>
                    ) : undefined
                  }
                  rightSub={
                    c.stats.outstanding > 0 ? (
                      <T variant="small" muted>
                        owed
                      </T>
                    ) : null
                  }
                  onPress={() => router.push(`/clients/${c.id}`)}
                />
              ))}
            </List>
          ) : null}
        </Screen>
      )}
    </View>
  );
}
