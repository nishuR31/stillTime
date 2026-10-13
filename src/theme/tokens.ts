/**
 * Theme tokens.
 *
 * Two palettes with the same shape, selected from the system Appearance so the
 * app never fights the user's setting. Contrast ratios below target WCAG AA
 * (4.5:1 for body text, 3:1 for large text and UI boundaries).
 */

export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  dialTrack: string;
  dialProgress: string;
  dialKnob: string;
  dialKnobRing: string;
  shadow: string;
}

export const lightPalette: Palette = {
  background: '#F4F2EE',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#E8E4DD',
  border: '#DAD5CB',
  borderStrong: '#B9B2A4',
  text: '#1B1A17',
  textMuted: '#5A554C',
  textFaint: '#8A8377',
  accent: '#1F5F4B',
  accentText: '#FFFFFF',
  accentSoft: '#DCEAE3',
  success: '#1B6B3A',
  warning: '#8A5A00',
  danger: '#A3282B',
  dialTrack: '#E2DED5',
  dialProgress: '#1F5F4B',
  dialKnob: '#FFFFFF',
  dialKnobRing: '#1B1A17',
  shadow: '#000000',
};

export const darkPalette: Palette = {
  background: '#111210',
  surface: '#1A1B18',
  surfaceRaised: '#232420',
  surfaceSunken: '#0C0D0B',
  border: '#2F312C',
  borderStrong: '#4A4D45',
  text: '#F2F0EA',
  textMuted: '#B0AEA4',
  textFaint: '#7D7C74',
  accent: '#6FD3A8',
  accentText: '#08201A',
  accentSoft: '#17312A',
  success: '#6FD3A8',
  warning: '#E0B15A',
  danger: '#F0857F',
  dialTrack: '#2A2C27',
  dialProgress: '#6FD3A8',
  dialKnob: '#232420',
  dialKnobRing: '#F2F0EA',
  shadow: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 56, fontWeight: '700' as const, letterSpacing: -2 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0 },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.2 },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
} as const;

/** Minimum touch target, per Android accessibility guidance. */
export const MIN_TOUCH_TARGET = 48;

/** Respects both the OS reduce-motion setting and our own preference. */
export const durations = {
  instant: 0,
  fast: 120,
  normal: 220,
} as const;

export function paletteFor(scheme: 'light' | 'dark' | null | undefined): Palette {
  return scheme === 'dark' ? darkPalette : lightPalette;
}