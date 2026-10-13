/**
 * Power & permission diagnostics.
 *
 * Reachable from the dial screen. Shows exactly what Stilltime observed, why a
 * write might have been deferred, and the two Settings destinations that can
 * actually change the outcome. Nothing is changed without an explicit tap.
 */

import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  BackLink,
  Banner,
  Button,
  Card,
  DetailRow,
  Footer,
  MutedText,
  Screen,
  SectionTitle,
  StatusPill,
  type BannerTone,
} from '../src/components/primitives';
import { manufacturerNote } from '../src/domain/powerPolicy';
import { formatDuration } from '../src/domain/timeouts';
import { getConstants } from '../src/native/screenTimeout';
import { useStilltime } from '../src/state/StilltimeProvider';
import { useTheme } from '../src/theme/useTheme';

const IMPACT_TONE: Record<'none' | 'noticeable' | 'blocked', BannerTone> = {
  none: 'success',
  noticeable: 'warning',
  blocked: 'error',
};

export default function PowerScreen(): React.JSX.Element {
  const theme = useTheme();
  const {
    power,
    powerGuidance,
    canWrite,
    observedMs,
    sdkInt,
    manufacturer,
    refresh,
    openWriteSettings,
    openBatterySettings,
    requestPermission,
  } = useStilltime();

  const oemNote = manufacturer.length > 0 ? manufacturerNote(manufacturer) : null;
  const { appVersion, buildNumber } = getConstants();

  return (
    <Screen theme={theme}>
      <BackLink theme={theme} onPress={() => router.back()} />

      <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
        Power &amp; permissions
      </Text>

      <Card theme={theme}>
        <SectionTitle theme={theme}>Modify system settings</SectionTitle>
        <View style={styles.row}>
          <StatusPill
            theme={theme}
            label={canWrite ? 'Granted' : 'Not granted'}
            tone={canWrite ? 'success' : 'warning'}
          />
          <Text style={[styles.value, { color: theme.colors.text }]}>
            {canWrite ? 'Stilltime can write' : 'Stilltime can only read'}
          </Text>
        </View>
        <MutedText theme={theme}>
          Android exposes “Modify system settings” as a revocable grant, separate from install-time
          permissions. Stilltime only ever uses it for{' '}
          <Text style={styles.mono}>Settings.System.SCREEN_OFF_TIMEOUT</Text>.
        </MutedText>
        <View style={styles.actions}>
          <Button
            theme={theme}
            label="Open system settings page"
            variant="secondary"
            onPress={() => void openWriteSettings()}
          />
          {!canWrite ? (
            <Button theme={theme} label="Grant permission" onPress={() => void requestPermission()} />
          ) : null}
        </View>
      </Card>

      <Card theme={theme}>
        <SectionTitle theme={theme}>Power state</SectionTitle>
        {power === null ? (
          <MutedText theme={theme}>Power state is not available on this device.</MutedText>
        ) : (
          <>
            <DetailRow theme={theme} label="Battery Saver" value={power.powerSaveMode ? 'On' : 'Off'} />
            <DetailRow theme={theme} label="Doze" value={power.deviceIdleMode ? 'Active' : 'Inactive'} />
            <DetailRow
              theme={theme}
              label="Battery optimisation exemption"
              value={power.ignoringBatteryOptimizations ? 'Granted' : 'Not granted'}
            />
            <DetailRow theme={theme} label="Android SDK" value={String(power.sdkInt || sdkInt)} />
            <DetailRow theme={theme} label="Manufacturer" value={manufacturer || 'Unknown'} />
          </>
        )}

        {powerGuidance !== null ? (
          <Banner
            theme={theme}
            tone={IMPACT_TONE[powerGuidance.impact]}
            title={powerGuidance.title}
            detail={powerGuidance.detail}
          />
        ) : null}

        {oemNote !== null ? (
          <Banner theme={theme} tone="info" title="Manufacturer note" detail={oemNote} />
        ) : null}

        <Button
          theme={theme}
          label="Open battery settings"
          variant="secondary"
          onPress={() => void openBatterySettings()}
        />
      </Card>

      <Card theme={theme}>
        <SectionTitle theme={theme}>Current value</SectionTitle>
        <Text style={[styles.bigValue, { color: theme.colors.text }]}>
          {observedMs === null ? '—' : formatDuration(observedMs)}
        </Text>
        <MutedText theme={theme}>
          Read directly from Android. Stilltime only reports success after it writes a value and
          reads the same value back.
        </MutedText>
        <Button theme={theme} label="Re-read from device" variant="secondary" onPress={() => void refresh()} />
      </Card>

      <Footer theme={theme} appVersion={appVersion} buildNumber={buildNumber} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    paddingVertical: 8,
    paddingRight: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 30,
  },
  rowLabel: {
    fontSize: 14,
    flexShrink: 1,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
  },
  bigValue: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  mono: {
    fontFamily: 'monospace',
  },
});