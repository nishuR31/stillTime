/**
 * Shared building blocks: Screen, Card, Button, Banner, Footer.
 */

import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MIN_TOUCH_TARGET, type Theme } from '../theme/useTheme';

export const PROJECT_URL = 'https://github.com/nishur31';

// -------------------------------------------------------------------------
// Layout
// -------------------------------------------------------------------------

export function Screen({
  theme,
  children,
  scroll = true,
  contentStyle,
}: {
  theme: Theme;
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + theme.spacing.lg,
    paddingBottom: insets.bottom + theme.spacing.xl,
    paddingLeft: insets.left + theme.spacing.lg,
    paddingRight: insets.right + theme.spacing.lg,
  };

  if (!scroll) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }, padding, contentStyle]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[padding, styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  theme,
  children,
  style,
  accessibilityLabel,
}: {
  theme: Theme;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          shadowColor: theme.colors.shadow,
          shadowOpacity: theme.scheme === 'dark' ? 0.35 : 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ theme, children }: { theme: Theme; children: string }): React.JSX.Element {
  return (
    <Text
      accessibilityRole="header"
      style={[styles.sectionTitle, { color: theme.colors.textMuted }]}
    >
      {children}
    </Text>
  );
}

// -------------------------------------------------------------------------
// Controls
// -------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export function Button({
  theme,
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  accessibilityHint,
  style,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const tones: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: theme.colors.accent, fg: theme.colors.accentText, border: theme.colors.accent },
    secondary: { bg: theme.colors.surface, fg: theme.colors.text, border: theme.colors.borderStrong },
    quiet: { bg: 'transparent', fg: theme.colors.accent, border: 'transparent' },
    danger: { bg: 'transparent', fg: theme.colors.danger, border: theme.colors.danger },
  };
  const tone = tones[variant];
  const isDisabled = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isDisabled ? theme.colors.surfaceSunken : tone.bg,
          borderColor: isDisabled ? theme.colors.border : tone.border,
          borderRadius: theme.radius.md,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[styles.buttonLabel, { color: isDisabled ? theme.colors.textFaint : tone.fg }]}
        numberOfLines={1}
      >
        {busy ? 'Working…' : label}
      </Text>
    </Pressable>
  );
}

export function PresetGrid({
  theme,
  values,
  selectedMs,
  disabled,
  onSelect,
}: {
  theme: Theme;
  values: readonly { id: string; label: string; ms: number }[];
  selectedMs: number | null;
  disabled: boolean;
  onSelect: (ms: number) => void;
}): React.JSX.Element {
  return (
    <View style={styles.presetGrid}>
      {values.map((preset) => {
        const selected = selectedMs === preset.ms;
        return (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            accessibilityLabel={`Set timeout to ${preset.label}`}
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            onPress={() => onSelect(preset.ms)}
            style={({ pressed }) => [
              styles.preset,
              {
                backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceSunken,
                borderColor: selected ? theme.colors.accent : theme.colors.border,
                borderRadius: theme.radius.pill,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.presetLabel,
                { color: selected ? theme.colors.accentText : theme.colors.text },
              ]}
            >
              {preset.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// -------------------------------------------------------------------------
// Feedback
// -------------------------------------------------------------------------

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

export function Banner({
  theme,
  tone,
  title,
  detail,
  onDismiss,
}: {
  theme: Theme;
  tone: BannerTone;
  title: string;
  detail: string;
  onDismiss?: () => void;
}): React.JSX.Element {
  const colors: Record<BannerTone, string> = {
    info: theme.colors.accent,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.danger,
  };

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.surface,
          borderColor: colors[tone],
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <View style={[styles.bannerStripe, { backgroundColor: colors[tone] }]} />
      <View style={styles.bannerBody}>
        <Text style={[styles.bannerTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.bannerDetail, { color: theme.colors.textMuted }]}>{detail}</Text>
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          style={styles.bannerDismiss}
          hitSlop={12}
        >
          <Text style={[styles.bannerDismissLabel, { color: theme.colors.textMuted }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatusPill({
  theme,
  label,
  tone,
}: {
  theme: Theme;
  label: string;
  tone: BannerTone;
}): React.JSX.Element {
  const colors: Record<BannerTone, string> = {
    info: theme.colors.accent,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.danger,
  };
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: theme.colors.surfaceSunken, borderColor: colors[tone] },
      ]}
    >
      <View style={[styles.pillDot, { backgroundColor: colors[tone] }]} />
      <Text style={[styles.pillLabel, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// -------------------------------------------------------------------------
// Footer
// -------------------------------------------------------------------------

export interface FooterProps {
  theme: Theme;
  /** `versionName`, e.g. "1.0.0". */
  appVersion?: string;
  /** `versionCode`, e.g. 1. */
  buildNumber?: number;
  /**
   * Fired by the hidden seven-tap gesture on the version line. Omit to render
   * the version as plain text.
   */
  onBuildVersionPress?: () => void;
  /** Taps still needed by the hidden gesture; `null` while it stays hidden. */
  buildVersionRemaining?: number | null;
}

export function Footer({
  theme,
  appVersion,
  buildNumber,
  onBuildVersionPress,
  buildVersionRemaining = null,
}: FooterProps): React.JSX.Element {
  const versionLine = buildVersion(appVersion, buildNumber);

  return (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { color: theme.colors.textFaint }]}>
        Stilltime is offline by design. No account, no tracking, no network access.
      </Text>

      {onBuildVersionPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Stilltime version ${versionLine}`}
          accessibilityHint="Build information"
          onPress={onBuildVersionPress}
          hitSlop={10}
        >
          <Text style={[styles.footerVersion, { color: theme.colors.textFaint }]}>
            {versionLine}
            {buildVersionRemaining !== null
              ? ` · ${buildVersionRemaining} more tap${
                  buildVersionRemaining === 1 ? '' : 's'
                }`
              : ''}
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.footerVersion, { color: theme.colors.textFaint }]}>
          {versionLine}
        </Text>
      )}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Stilltime source code on GitHub"
        accessibilityHint="Opens github.com/nishur31 in your browser"
        onPress={() => {
          void Linking.openURL(PROJECT_URL).catch(() => undefined);
        }}
        hitSlop={8}
      >
        <Text style={[styles.footerLink, { color: theme.colors.accent }]}>{PROJECT_URL}</Text>
      </Pressable>
    </View>
  );
}

function buildVersion(appVersion?: string, buildNumber?: number): string {
  const version = appVersion && appVersion !== 'unknown' ? appVersion : '—';
  const code = typeof buildNumber === 'number' && buildNumber > 0 ? ` (${buildNumber})` : '';
  return `Stilltime ${version}${code}`;
}

// -------------------------------------------------------------------------
// Information display
// -------------------------------------------------------------------------

/** Label on the left, value on the right. Used for "what does the device say". */
export function DetailRow({
  theme,
  label,
  value,
  tone,
}: {
  theme: Theme;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}): React.JSX.Element {
  const toneColor =
    tone === 'success'
      ? theme.colors.success
      : tone === 'warning'
        ? theme.colors.warning
        : tone === 'danger'
          ? theme.colors.danger
          : theme.colors.text;

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: toneColor }]}>{value}</Text>
    </View>
  );
}

/** A tappable line that navigates somewhere, with a chevron affordance. */
export function LinkRow({
  theme,
  label,
  hint,
  onPress,
}: {
  theme: Theme;
  label: string;
  hint?: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surfaceSunken,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.linkRowBody}>
        <Text style={[styles.linkRowLabel, { color: theme.colors.text }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.linkRowHint, { color: theme.colors.textMuted }]}>{hint}</Text>
        ) : null}
      </View>
      <Text style={[styles.linkRowChevron, { color: theme.colors.textFaint }]}>›</Text>
    </Pressable>
  );
}

/** Back affordance shared by every secondary screen. */
export function BackLink({ theme, onPress, label = 'Back' }: { theme: Theme; onPress: () => void; label?: string }): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={12}
      style={styles.back}
    >
      <Text style={[styles.backLabel, { color: theme.colors.accent }]}>‹ {label}</Text>
    </Pressable>
  );
}

// -------------------------------------------------------------------------
// Loading
// -------------------------------------------------------------------------

/**
 * A grey block standing in for content that has not arrived.
 *
 * Deliberately not an animated shimmer: the first load is short, and a
 * looping animation is a battery cost on a screen that will be replaced in a
 * few hundred milliseconds.
 */
export function Skeleton({
  theme,
  height,
  width = '100%',
  radius,
}: {
  theme: Theme;
  height: number;
  width?: number | `${number}%`;
  radius?: number;
}): React.JSX.Element {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height,
        width,
        borderRadius: radius ?? theme.radius.sm,
        backgroundColor: theme.colors.surfaceSunken,
      }}
    />
  );
}

/**
 * First-load placeholder for the dial screen.
 *
 * Shaped like the real content so the layout does not jump when data arrives.
 */
export function LoadingState({ theme }: { theme: Theme }): React.JSX.Element {
  return (
    <View
      style={styles.loading}
      accessibilityRole="progressbar"
      accessibilityLabel="Reading the current screen timeout"
    >
      <View style={styles.loadingHeader}>
        <Skeleton theme={theme} height={30} width="45%" />
        <Skeleton theme={theme} height={26} width="30%" radius={999} />
      </View>
      <Skeleton theme={theme} height={260} radius={999} />
      <Skeleton theme={theme} height={48} />
      <Skeleton theme={theme} height={140} />
    </View>
  );
}

export function MutedText({
  theme,
  children,
  style,
}: {
  theme: Theme;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}): React.JSX.Element {
  return <Text style={[styles.muted, { color: theme.colors.textMuted }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    flexGrow: 1,
  },
  card: {
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preset: {
    minWidth: 68,
    minHeight: MIN_TOUCH_TARGET - 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    overflow: 'hidden',
  },
  bannerStripe: {
    width: 4,
  },
  bannerBody: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bannerDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
  bannerDismiss: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  bannerDismissLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    gap: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  footerVersion: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 30,
  },
  detailLabel: {
    fontSize: 14,
    flexShrink: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
    textAlign: 'right',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: MIN_TOUCH_TARGET + 6,
  },
  linkRowBody: {
    flexShrink: 1,
    gap: 2,
  },
  linkRowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  linkRowHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  linkRowChevron: {
    fontSize: 24,
    fontWeight: '400',
  },
  back: {
    paddingVertical: 8,
    paddingRight: 12,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  loading: {
    gap: 20,
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
  },
});