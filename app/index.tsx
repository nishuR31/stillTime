/**
 * The dial screen: the app's home.
 */

import { router } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TimeoutDial } from '../src/components/TimeoutDial';
import { useTapSequence } from '../src/components/useTapSequence';
import {
  Banner,
  Button,
  Card,
  Footer,
  LinkRow,
  LoadingState,
  MutedText,
  PresetGrid,
  Screen,
  SectionTitle,
  StatusPill,
} from '../src/components/primitives';
import { formatDuration, clampTimeout, isDisplayableTimeout, TIMEOUT_PRESETS } from '../src/domain/timeouts';
import { getConstants } from '../src/native/screenTimeout';
import { useStilltime } from '../src/state/StilltimeProvider';
import { useTheme } from '../src/theme/useTheme';

export default function DialScreen(): React.JSX.Element {
  const theme = useTheme();
  const {
    status,
    observedMs,
    draftMs,
    canWrite,
    busy,
    notice,
    fatalError,
    outsideDialBounds,
    stayAwake,
    setDraftMs,
    beginDrag,
    endDrag,
    tickSelection,
    apply,
    requestPermission,
    toggleStayAwake,
    dismissNotice,
  } = useStilltime();

  const loading = status === 'idle' || status === 'loading';
  const dirty = observedMs !== null && clampTimeout(observedMs) !== draftMs;

  const selectedPreset = useMemo(
    () => TIMEOUT_PRESETS.find((preset) => preset.ms === draftMs)?.ms ?? null,
    [draftMs],
  );

  const onSelectPreset = useCallback(
    (ms: number) => {
      setDraftMs(ms);
      tickSelection();
    },
    [setDraftMs, tickSelection],
  );

  const stayAwakeActive = stayAwake?.active ?? false;
  const stayAwakeDrifted = stayAwake?.drifted ?? false;

  // Hidden entry point to the screen-off test, the same gesture Android uses
  // for Developer options. Seven taps on the build version, within a rolling
  // window, with no visible affordance until the user is clearly part-way in.
  const { appVersion, buildNumber } = getConstants();
  const buildVersionTaps = useTapSequence({
    required: 7,
    onComplete: () => router.push('/testing'),
  });

  if (fatalError !== null) {
    return (
      <Screen theme={theme}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
          Stilltime could not start
        </Text>
        <Banner theme={theme} tone="error" title="Native module unavailable" detail={fatalError} />
        <MutedText theme={theme}>
          Stilltime reads and writes a real Android system setting, so it needs a native Android
          build. It does not run in Expo Go.
        </MutedText>
        <MutedText theme={theme}>Build it with: bun run prebuild &amp;&amp; bun run android</MutedText>
      </Screen>
    );
  }

  // First load. A skeleton shaped like the real screen beats a half-populated
  // dial, because nothing on it is trustworthy until the device has answered.
  if (status === 'idle' || status === 'loading') {
    return (
      <Screen theme={theme}>
        <LoadingState theme={theme} />
      </Screen>
    );
  }

  return (
    <Screen theme={theme}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
            Stilltime
          </Text>
          <MutedText theme={theme}>Screen off timeout</MutedText>
        </View>
        <StatusPill
          theme={theme}
          label={loading ? 'Reading…' : canWrite ? 'Ready' : 'Permission needed'}
          tone={loading ? 'info' : canWrite ? 'success' : 'warning'}
        />
      </View>

      {!canWrite && !loading ? (
        <Card theme={theme}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Stilltime needs permission
          </Text>
          <MutedText theme={theme}>
            Android only lets an app change system settings after you grant “Modify system
            settings”. Nothing leaves your device.
          </MutedText>
          <Button
            theme={theme}
            label="Grant permission"
            onPress={() => void requestPermission()}
            accessibilityHint="Opens Android's app permissions page for Stilltime"
          />
        </Card>
      ) : null}

      {notice !== null ? (
        <Banner
          theme={theme}
          tone={notice.tone}
          title={notice.title}
          detail={notice.detail}
          onDismiss={dismissNotice}
        />
      ) : null}

      <TimeoutDial
        theme={theme}
        valueMs={draftMs}
        observedMs={isDisplayableTimeout(observedMs) ? observedMs : null}
        disabled={loading}
        onChange={setDraftMs}
        onDetent={tickSelection}
        onDragStart={beginDrag}
        onDragEnd={endDrag}
      />

      {outsideDialBounds && observedMs !== null ? (
        <Banner
          theme={theme}
          tone="warning"
          title="Device value is outside the dial range"
          detail={`The device is set to ${formatDuration(observedMs)}. Stilltime can still write a new value, but the dial cannot show the current one.`}
        />
      ) : null}

      <View style={styles.applyRow}>
        <Button
          theme={theme}
          label={dirty ? `Set to ${formatDuration(draftMs)}` : 'Already set'}
          onPress={() => void apply()}
          disabled={loading || !canWrite}
          busy={busy}
          style={styles.grow}
          accessibilityHint="Writes the selected timeout to Android and verifies it"
        />
      </View>

      <Card theme={theme}>
        <SectionTitle theme={theme}>Presets</SectionTitle>
        <PresetGrid
          theme={theme}
          values={TIMEOUT_PRESETS}
          selectedMs={selectedPreset}
          disabled={loading}
          onSelect={onSelectPreset}
        />
      </Card>

      <Card theme={theme}>
        <SectionTitle theme={theme}>Stay Awake</SectionTitle>
        <MutedText theme={theme}>
          Holds a 30 minute timeout while you use Stilltime, then puts your previous value back.
          Stilltime never runs a background service or holds a wake lock.
        </MutedText>
        {stayAwakeDrifted ? (
          <Banner
            theme={theme}
            tone="warning"
            title="Timeout changed elsewhere"
            detail="Stop Stay Awake will leave your current value untouched."
          />
        ) : null}
        <Button
          theme={theme}
          label={stayAwakeActive ? 'Stop Stay Awake' : 'Start Stay Awake'}
          variant={stayAwakeActive ? 'secondary' : 'primary'}
          onPress={() => void toggleStayAwake()}
          disabled={loading || !canWrite}
          busy={busy}
        />
      </Card>

      <Card theme={theme}>
        <SectionTitle theme={theme}>Diagnostics</SectionTitle>
        <MutedText theme={theme}>
          Battery Saver, Doze and manufacturer restrictions can defer a write. Inspect what Stilltime
          actually observed before blaming the app.
        </MutedText>
        <Button
          theme={theme}
          label="Power & permissions"
          variant="secondary"
          onPress={() => router.push('/power')}
          accessibilityHint="Opens the diagnostics screen"
        />
      </Card>

      <Card theme={theme}>
        <SectionTitle theme={theme}>About &amp; transparency</SectionTitle>
        <MutedText theme={theme}>
          What Stilltime reads, what it stores, and every permission it asks for — plus draft terms.
        </MutedText>
        <View style={styles.aboutLinks}>
          <LinkRow
            theme={theme}
            label="About Stilltime"
            hint="What it does, and what it refuses to do."
            onPress={() => router.push('/about')}
          />
          <LinkRow
            theme={theme}
            label="How to use it"
            hint="Grant the permission, turn the dial, verify the value."
            onPress={() => router.push('/how-to-use')}
          />
          <LinkRow
            theme={theme}
            label="Permissions, privacy &amp; security"
            hint="Everything Stilltime asks for, and why."
            onPress={() => router.push('/permissions')}
          />
        </View>
      </Card>

      <Footer
        theme={theme}
        appVersion={appVersion}
        buildNumber={buildNumber}
        onBuildVersionPress={buildVersionTaps.onPress}
        buildVersionRemaining={buildVersionTaps.remaining}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flexShrink: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  dialArea: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  applyRow: {
    flexDirection: 'row',
  },
  aboutLinks: {
    gap: 10,
  },
  grow: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
});