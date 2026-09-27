import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorView, Loading, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_URL } from '@/lib/config';
import { useMe } from '@/lib/queries';
import { queryClient } from '@/lib/query-client';
import { usePushNotifications, useSignOut } from '@/lib/session';

/** Business setup (name, tax, numbering) lives on the web for now. */
function FinishSetup() {
  const theme = useTheme();
  const signOut = useSignOut();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: Spacing.four, justifyContent: 'center', gap: Spacing.three }}>
        <T variant="title">Set up your business</T>
        <T muted>
          Add your business name, VAT details and invoice numbering on the InvoiceGen website first. It
          takes about two minutes; then come back here.
        </T>
        <Button label="Open setup on the web" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/onboarding`)} />
        <Button label="I've finished, check again" variant="secondary" onPress={() => queryClient.invalidateQueries({ queryKey: ['me'] })} />
        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

export default function AppLayout() {
  const me = useMe();
  usePushNotifications(Boolean(me.data?.onboardingCompleted));

  if (me.isPending) return <Loading />;
  if (me.isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.four }}>
        <ErrorView message={me.error.message} onRetry={() => me.refetch()} />
      </View>
    );
  }
  if (!me.data.onboardingCompleted) return <FinishSetup />;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="documents/new" options={{ title: 'New document', presentation: 'modal' }} />
      <Stack.Screen name="documents/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="documents/[id]/payment" options={{ title: 'Record payment', presentation: 'modal' }} />
      <Stack.Screen name="clients/new" options={{ title: 'New client', presentation: 'modal' }} />
      <Stack.Screen name="clients/[id]" options={{ title: '' }} />
    </Stack>
  );
}
