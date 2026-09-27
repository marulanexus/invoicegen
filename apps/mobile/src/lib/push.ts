import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Api } from '@/lib/api';

/**
 * Push notifications (payment received, invoice opened, overdue).
 *
 * Limits (Expo SDK 57): remote push needs a real device; Android needs a
 * development/production build (Expo Go on Android has no push since SDK 53);
 * and tokens need the EAS project id from `eas init`. Where push isn't
 * possible we skip quietly; the rest of the app works the same.
 */

const TOKEN_KEY = 'invoicegen.pushToken';

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushSetup = 'registered' | 'denied' | 'unsupported' | 'not-configured' | 'failed';

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function pushSupported(): boolean {
  if (!Device.isDevice) return false;
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  return !(inExpoGo && Platform.OS === 'android');
}

/** Ask permission (once), get this phone's Expo token and register it for the signed-in owner. */
export async function registerForPush(api: Api): Promise<PushSetup> {
  if (!pushSupported()) return 'unsupported';
  const id = projectId();
  if (!id) return 'not-configured';

  try {
    // Android 13+ only shows the permission prompt once a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Payments and invoices',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await api.registerDevice({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return 'registered';
  } catch (err) {
    console.warn('[push] registration failed', err);
    return 'failed';
  }
}

/** Stop pushes to this phone before signing out, so the next person doesn't get them. */
export async function unregisterPush(api: Api): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) return;
  try {
    await api.unregisterDevice(token);
  } catch {
    // Already gone, or offline: the server also drops dead tokens when pushes bounce.
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
}

/** The document a notification points at, if any. */
export function documentIdFrom(response: Notifications.NotificationResponse | null | undefined): string | null {
  const id = response?.notification.request.content.data?.documentId;
  return typeof id === 'string' ? id : null;
}
