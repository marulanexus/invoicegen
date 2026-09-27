import type { ClientWithStats } from '@invoicegen/shared/api';
import { router } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Empty, Field, List, Loading, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useClients } from '@/lib/queries';

/** Full-screen client chooser with search and a shortcut to add a new client. */
export function ClientPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (client: ClientWithStats | null) => void;
}) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search.trim());
  const clients = useClients({ search: deferred || undefined, status: 'active' });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ padding: Spacing.three, gap: Spacing.two, flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Choose a client" value={search} onChangeText={setSearch} placeholder="Search" autoFocus autoCorrect={false} />
          </View>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>
        {clients.isPending ? (
          <Loading />
        ) : (
          <Screen>
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button
                label="New client"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  onClose();
                  router.push('/clients/new');
                }}
              />
              <Button label="No client" variant="ghost" style={{ flex: 1 }} onPress={() => onPick(null)} />
            </View>
            {clients.data && clients.data.length === 0 ? <Empty title="No clients found" /> : null}
            {clients.data && clients.data.length > 0 ? (
              <List>
                {clients.data.map((c) => (
                  <Row key={c.id} title={c.name} subtitle={c.companyName ?? c.email ?? undefined} onPress={() => onPick(c)} />
                ))}
              </List>
            ) : null}
          </Screen>
        )}
      </SafeAreaView>
    </Modal>
  );
}
