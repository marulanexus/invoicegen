import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tone } from '@/lib/format';

/* ─────────────────────────────── Text ─────────────────────────────── */

type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'small' | 'amount';

export function T({
  variant = 'body',
  muted,
  tone,
  style,
  children,
  numberOfLines,
}: {
  variant?: TextVariant;
  muted?: boolean;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  const color = tone ? toneColors(theme, tone).fg : muted ? theme.textSecondary : theme.text;
  return (
    <Text numberOfLines={numberOfLines} style={[text[variant], { color }, style]}>
      {children}
    </Text>
  );
}

const text = StyleSheet.create({
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18 },
  amount: { fontSize: 24, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
});

/* ───────────────────────────── Layout ─────────────────────────────── */

/** Scrollable screen body with pull-to-refresh. */
export function Screen({
  children,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={theme.primary} />
          ) : undefined
        }>
        {children}
      </ScrollView>
      {footer ? (
        <View style={{ padding: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.backgroundElement }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View
      style={[
        { backgroundColor: theme.backgroundElement, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, padding: Spacing.three, gap: Spacing.two },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="label" muted>
          {title.toUpperCase()}
        </T>
        {action}
      </View>
      {children}
    </View>
  );
}

/** A label/value line, e.g. "Balance due   R 1 150,00". */
export function KeyValue({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three }}>
      <T muted>{label}</T>
      <T variant={strong ? 'heading' : 'body'} style={{ textAlign: 'right', flexShrink: 1 }}>
        {value}
      </T>
    </View>
  );
}

/* ───────────────────────────── Controls ───────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: theme.primary, fg: theme.onPrimary, border: theme.primary },
    secondary: { bg: theme.backgroundElement, fg: theme.text, border: theme.border },
    danger: { bg: theme.backgroundElement, fg: theme.danger, border: theme.border },
    ghost: { bg: 'transparent', fg: theme.primary, border: 'transparent' },
  };
  const c = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: 12,
          paddingHorizontal: Spacing.three,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: Spacing.two,
          backgroundColor: c.bg,
          borderWidth: 1,
          borderColor: c.border,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <T variant="label">{label}</T>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label}
        {...input}
        style={[
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor: error ? theme.danger : theme.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 16,
            color: theme.text,
            backgroundColor: theme.backgroundElement,
          },
          input.multiline ? { minHeight: 88, textAlignVertical: 'top' } : null,
          input.style,
        ]}
      />
      {error ? (
        <T variant="small" tone="danger">
          {error}
        </T>
      ) : hint ? (
        <T variant="small" muted>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={{
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: 18,
        justifyContent: 'center',
        backgroundColor: selected ? theme.primary : theme.backgroundElement,
        borderWidth: 1,
        borderColor: selected ? theme.primary : theme.border,
      }}>
      <Text style={{ color: selected ? theme.onPrimary : theme.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
      {children}
    </ScrollView>
  );
}

/* ───────────────────────────── Display ────────────────────────────── */

function toneColors(theme: ReturnType<typeof useTheme>, tone: Tone) {
  switch (tone) {
    case 'success':
      return { fg: theme.success, bg: theme.successSoft };
    case 'warning':
      return { fg: theme.warning, bg: theme.warningSoft };
    case 'danger':
      return { fg: theme.danger, bg: theme.dangerSoft };
    case 'info':
      return { fg: theme.primary, bg: theme.neutralSoft };
    default:
      return { fg: theme.textSecondary, bg: theme.neutralSoft };
  }
}

export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const theme = useTheme();
  const c = toneColors(theme, tone);
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/** A tappable list row: title/subtitle on the left, value/badge on the right. */
export function Row({
  title,
  subtitle,
  right,
  rightSub,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  rightSub?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        paddingVertical: 12,
        paddingHorizontal: Spacing.three,
        minHeight: 60,
        backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
      })}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" muted numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {typeof right === 'string' ? <T variant="label">{right}</T> : right}
        {rightSub}
      </View>
    </Pressable>
  );
}

/** Rows inside one rounded card, separated by hairlines. */
export function List({ children }: { children: ReactNode[] }) {
  const theme = useTheme();
  const items = children.filter(Boolean);
  return (
    <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }}>
      {items.map((child, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border } : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five, backgroundColor: theme.background }}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );
}

export function Empty({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: Spacing.five }}>
      <T variant="heading">{title}</T>
      {message ? (
        <T muted style={{ textAlign: 'center' }}>
          {message}
        </T>
      ) : null}
      {action}
    </Card>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ gap: Spacing.three }}>
      <T variant="heading" tone="danger">
        Couldn&apos;t load this
      </T>
      <T muted>{message}</T>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}
