/**
 * Theme hook.
 *
 * Uses `useColorScheme` from React Native, which already tracks the system
 * Appearance. A module-level listener keeps `reduceMotion` current.
 */

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import {
  durations,
  paletteFor,
  radius,
  spacing,
  typography,
  type Palette,
} from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  reduceMotion: boolean;
  /** Duration helper that collapses to 0 when motion is reduced. */
  motion: (milliseconds: number) => number;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled),
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return useMemo<Theme>(() => {
    const resolved = scheme === 'dark' ? 'dark' : 'light';
    return {
      scheme: resolved,
      colors: paletteFor(resolved),
      spacing,
      radius,
      typography,
      reduceMotion,
      motion: (milliseconds: number) => (reduceMotion ? durations.instant : milliseconds),
    };
  }, [scheme, reduceMotion]);
}

export type ThemeInput = ReturnType<typeof useTheme>;
export * from './tokens';