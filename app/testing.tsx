/**
 * Screen-off test.
 *
 * Reached only by tapping the build version in the footer seven times, the same
 * gesture Android uses for Developer options. It is a diagnostic, not a toy:
 * Stilltime can prove it *wrote* a value, but only the device can prove it
 * *honoured* one, and this page is where that gap gets closed.
 *
 * The flow is deliberately slow and boring:
 *
 *   1. Optionally write a short timeout (15s) so the test finishes quickly.
 *   2. Arm the native probe. It listens for `ACTION_SCREEN_OFF`.
 *   3. The user leaves the app and does not touch the screen.
 *   4. Android turns the screen off; the native receiver records the elapsed
 *      time and — if a restore was requested — puts the old timeout back
 *      immediately, because the device suspends right afterwards.
 *   5. The user returns; this screen re-reads the result on every resume.
 *
 * Nothing is hidden from the user: the page says which timeout is live, what
 * will be restored, and what a failure actually means.
 */

import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import {
  BackLink,
  Banner,
  Button,
  Card,
  DetailRow,
  MutedText,
  Screen,
  SectionTitle,
  StatusPill,
} from '../src/components/primitives';
import {
  assessProbe,
  formatMeasured,
  isProbeRunning,
  QUICK_TEST_MS,
  toleranceFor,
} from '../src/domain/screenOffProbe';
import { formatDuration } from '../src/domain/timeouts';
import type { ScreenOffProbeResult } from '../src/native/types';
import { useStilltime } from '../src/state/StilltimeProvider';
import { useTheme } from '../src/theme/useTheme';

export default function TestingScreen(): React.JSX.Element {
  const theme = useTheme();
  const { client, canWrite, observedMs, status, refresh, announce } = useStilltime();

  const [probe, setProbe] = useState<ScreenOffProbeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Ticks once a second only while a probe is armed, to show the countdown. */
  const [, setTick] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const readProbe = useCallback(async (): Promise<void> => {
    try {
      const result = await client.getScreenOffProbe();
      if (mountedRef.current) {
        setProbe(result);
        setError(null);
      }
    } catch (cause) {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause.message : 'Could not read the test result.');
      }
    }
  }, [client]);

  // Read whatever the previous run left behind on launch.
  //
  // This is an async pull from the native module: `readProbe` awaits before it
  // touches state, so it is not the synchronous setState-in-an-effect the lint
  // rule is guarding against. There is no event to subscribe to for "the page
  // became visible", and the result has to be on screen immediately.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void readProbe();
  }, [readProbe]);

  // The whole point of the page: come back and find out what happened.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void readProbe();
    });
    return () => subscription.remove();
  }, [readProbe]);

  const running = isProbeRunning(probe);

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => setTick((value) => value + 1), 1_000);
    return () => clearInterval(interval);
  }, [running]);

  const assessment = assessProbe(probe);

  /**
   * Write a short timeout, arm the probe, and ask for the previous value back.
   *
   * The write goes through the normal verified path first: arming a probe
   * against a value the device never accepted would produce a meaningless
   * measurement.
   */
  const runQuickTest = useCallback(async () => {
    const restoreToMs = observedMs;
    if (restoreToMs === null) {
      setError('Stilltime has not read the current timeout yet.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await client.applyTimeout(QUICK_TEST_MS);
      const armed = await client.startScreenOffProbe(result.snapshot.appliedMs, restoreToMs);
      if (!mountedRef.current) return;
      setProbe(armed);
      announce({
        id: 'probe-armed',
        tone: 'info',
        title: 'Quick test armed',
        detail: `The timeout is now ${formatDuration(
          QUICK_TEST_MS,
        )}. Leave the app, do not touch the screen, and come back.`,
      });
      void refresh();
    } catch (cause) {
      if (!mountedRef.current) return;
      const message = cause instanceof Error ? cause.message : 'Could not start the test.';
      setError(message);
      announce({ id: 'probe-failed', tone: 'error', title: 'Test could not start', detail: message });
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [announce, client, observedMs, refresh]);

  /** Measure whatever is already on the device without changing anything. */
  const runCurrentTest = useCallback(async () => {
    const expected = observedMs;
    if (expected === null) {
      setError('Stilltime has not read the current timeout yet.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const armed = await client.startScreenOffProbe(expected, null);
      if (!mountedRef.current) return;
      setProbe(armed);
      announce({
        id: 'probe-armed-current',
        tone: 'info',
        title: 'Test armed',
        detail: `Leave the app and do not touch the screen for about ${formatDuration(
          expected,
        )}.`,
      });
    } catch (cause) {
      if (!mountedRef.current) return;
      const message = cause instanceof Error ? cause.message : 'Could not start the test.';
      setError(message);
      announce({ id: 'probe-failed', tone: 'error', title: 'Test could not start', detail: message });
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [announce, client, observedMs]);

  const cancelTest = useCallback(async () => {
    setBusy(true);
    try {
      const result = await client.cancelScreenOffProbe();
      if (mountedRef.current) setProbe(result);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [client]);

  // Only a completed run has a real measurement. An interrupted or stale run
  // can still carry a partial number, and showing that as "the screen went off
  // after …" would be actively misleading — the whole point of reporting those
  // states as unmeasured is that the number means nothing.
  const measured = probe?.state === 'completed' ? (probe.measuredMs ?? null) : null;
  const expected = probe?.expectedMs ?? null;

  return (
    <Screen theme={theme}>
      <BackLink theme={theme} onPress={() => router.back()} />

      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
          Screen-off test
        </Text>
        <StatusPill
          theme={theme}
          label={running ? 'Running' : probe?.state === 'completed' ? 'Finished' : 'Idle'}
          tone={running ? 'info' : assessment.verdict === 'match' ? 'success' : 'info'}
        />
      </View>

      <MutedText theme={theme}>
        Android never tells an app what it actually did with the screen timeout. A battery manager,
        a manufacturer policy or Doze can override a value that was written successfully. This test
        listens for the system broadcast that fires the moment the screen goes dark, and compares
        the real elapsed time against what you asked for.
      </MutedText>

      {error !== null ? (
        <Banner theme={theme} tone="error" title="Test problem" detail={error} />
      ) : null}

      <Card theme={theme}>
        <SectionTitle theme={theme}>Result</SectionTitle>
        <Banner
          theme={theme}
          tone={assessment.tone}
          title={assessment.title}
          detail={assessment.detail}
        />

        {expected !== null ? (
          <DetailRow theme={theme} label="Requested" value={formatMeasured(expected)} />
        ) : null}
        {measured !== null ? (
          <DetailRow
            theme={theme}
            label="Screen actually went off after"
            value={formatMeasured(measured)}
          />
        ) : null}
        {assessment.deltaMs !== null ? (
          <DetailRow
            theme={theme}
            label="Difference"
            value={`${assessment.deltaMs > 0 ? '+' : ''}${formatMeasured(
              Math.abs(assessment.deltaMs),
            )}`}
            tone={assessment.verdict === 'match' ? 'success' : 'warning'}
          />
        ) : null}
        {expected !== null && assessment.verdict !== 'waiting' ? (
          <DetailRow theme={theme} label="Tolerance" value={formatMeasured(toleranceFor(expected))} />
        ) : null}
        {probe !== null && probe.restoreToMs !== null ? (
          <DetailRow
            theme={theme}
            label="Previous timeout restored"
            value={probe.restored ? `Yes, ${formatDuration(probe.restoreToMs)}` : 'Could not confirm'}
            tone={probe.restored ? 'success' : 'warning'}
          />
        ) : null}

        {running ? (
          <MutedText theme={theme}>
            {countdownLine(probe)} The result appears when you come back.
          </MutedText>
        ) : null}
      </Card>

      <Card theme={theme}>
        <SectionTitle theme={theme}>Run a test</SectionTitle>

        {!canWrite ? (
          <Banner
            theme={theme}
            tone="warning"
            title="Permission required"
            detail="Stilltime cannot write a timeout without the “Modify system settings” grant. Grant it from the main screen first."
          />
        ) : null}

        <MutedText theme={theme}>
          Quick test writes {formatDuration(QUICK_TEST_MS)}, measures the screen, then puts your
          current value back automatically — even if the app is closed in the meantime.
        </MutedText>
        <Button
          theme={theme}
          label={running ? 'Test already running' : `Quick test — ${formatDuration(QUICK_TEST_MS)}`}
          onPress={() => void runQuickTest()}
          disabled={!canWrite || busy || running || status === 'loading'}
          busy={busy}
        />

        <MutedText theme={theme}>
          Testing the current setting changes nothing, but you have to wait the full length of the
          timeout without touching the screen.
        </MutedText>
        <Button
          theme={theme}
          label={
            observedMs === null
              ? 'Test the current setting'
              : `Test current setting — ${formatDuration(observedMs)}`
          }
          variant="secondary"
          onPress={() => void runCurrentTest()}
          disabled={!canWrite || busy || running || status === 'loading'}
        />

        {running ? (
          <Button
            theme={theme}
            label="Cancel test"
            variant="danger"
            onPress={() => void cancelTest()}
            disabled={busy}
          />
        ) : null}
      </Card>

      <Card theme={theme}>
        <SectionTitle theme={theme}>Read this before you trust the number</SectionTitle>
        <MutedText theme={theme}>
          Android&rsquo;s screen-off timer restarts on every touch, key press and sensor wake. The
          test only means something if the phone is genuinely left alone.
        </MutedText>
        <MutedText theme={theme}>
          Always-on display and proximity sensors can produce extra screen-on/off broadcasts. If the
          result says the screen came back on early, that is what happened — not a failure of the
          write.
        </MutedText>
        <MutedText theme={theme}>
          If Stilltime is killed while the screen is off, the result cannot be recorded and the run
          is reported as unmeasured. That is a limit of Android, not a bug in the app.
        </MutedText>
      </Card>
    </Screen>
  );
}

/** "About 12s left." Derived from the wall clock the native side recorded. */
function countdownLine(probe: ScreenOffProbeResult | null): string {
  if (!probe || probe.armedAtWallMs === null || probe.expectedMs === null) return 'Waiting.';

  const elapsed = Date.now() - probe.armedAtWallMs;
  if (elapsed < 0) return 'Waiting.';

  const remaining = probe.expectedMs - elapsed;
  if (remaining <= 0) {
    const over = -remaining;
    return `Past the expected timeout by ${formatMeasured(over)}.`;
  }
  return `About ${formatMeasured(remaining)} to go.`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    flexShrink: 1,
  },
});
