import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { ApiError } from '@/lib/api';

// Refetch stale data whenever the app comes back to the foreground, so changes
// made on the web show up without a manual refresh.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry flaky networks, not answers that won't change.
      retry: (failures, error) =>
        failures < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});
