/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B0F19',
    background: '#F6F7F9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E7EAF0',
    textSecondary: '#5B6270',
    border: '#E2E5EB',
    primary: '#2563EB',
    onPrimary: '#FFFFFF',
    success: '#15803D',
    successSoft: '#DCFCE7',
    warning: '#B45309',
    warningSoft: '#FEF3C7',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    neutralSoft: '#EEF0F4',
  },
  dark: {
    text: '#F3F4F6',
    background: '#0B0F19',
    backgroundElement: '#151A26',
    backgroundSelected: '#222938',
    textSecondary: '#A0A7B4',
    border: '#262D3B',
    primary: '#3B82F6',
    onPrimary: '#FFFFFF',
    success: '#4ADE80',
    successSoft: '#14301F',
    warning: '#FBBF24',
    warningSoft: '#352A10',
    danger: '#F87171',
    dangerSoft: '#3A1719',
    neutralSoft: '#1E2432',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
