import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Large title for top-level tab screens (native tabs don't draw a header). */
export function TabHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingBottom: Spacing.two,
        backgroundColor: theme.background,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: Spacing.two,
      }}>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <T variant="small" muted numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
        <T variant="title" numberOfLines={1}>
          {title}
        </T>
      </View>
      {right}
    </View>
  );
}
