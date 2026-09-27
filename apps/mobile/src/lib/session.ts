import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useApi } from '@/lib/api';
import { documentIdFrom, registerForPush, unregisterPush } from '@/lib/push';

/**
 * Sign out cleanly: stop pushes to this phone first (needs the session), then
 * drop cached business data so the next account never sees it.
 */
export function useSignOut() {
  const { signOut } = useAuth();
  const api = useApi();
  const qc = useQueryClient();
  return async () => {
    await unregisterPush(api);
    qc.clear();
    await signOut();
  };
}

/**
 * Register for push once the business is set up; refresh data when a
 * notification arrives; open the document when one is tapped (also when the
 * tap launched the app).
 */
export function usePushNotifications(enabled: boolean) {
  const api = useApi();
  const qc = useQueryClient();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (enabled) void registerForPush(api);
  }, [enabled, api]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document'] });
    });
    return () => sub.remove();
  }, [qc]);

  useEffect(() => {
    if (!enabled || !lastResponse) return;
    const key = lastResponse.notification.request.identifier;
    const documentId = documentIdFrom(lastResponse);
    if (documentId && handled.current !== key) {
      handled.current = key;
      router.push(`/documents/${documentId}`);
    }
  }, [enabled, lastResponse]);
}
