import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sign-in runs on Clerk's hosted page in a secure browser, so every method
 * enabled for the web (email code, Google, Microsoft, MFA) works here too.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const { startHostedAuth } = useHostedAuth();
  const [busy, setBusy] = useState<'sign-in' | 'sign-up' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(mode: 'sign-in' | 'sign-up') {
    setBusy(mode);
    setError(null);
    try {
      // On success the session activates and the root layout switches to the app.
      await startHostedAuth({ mode });
    } catch {
      setError("Couldn't open sign-in. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: Spacing.four, justifyContent: 'center', gap: Spacing.five }}>
        <View style={{ gap: Spacing.two }}>
          <T variant="title">InvoiceGen</T>
          <T muted>Send invoices, share them on WhatsApp and see who&apos;s paid, from your phone.</T>
        </View>
        <View style={{ gap: Spacing.three }}>
          <Button label="Sign in" onPress={() => start('sign-in')} loading={busy === 'sign-in'} disabled={busy !== null} />
          <Button
            label="Create an account"
            variant="secondary"
            onPress={() => start('sign-up')}
            loading={busy === 'sign-up'}
            disabled={busy !== null}
          />
          {error ? (
            <T variant="small" tone="danger">
              {error}
            </T>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
