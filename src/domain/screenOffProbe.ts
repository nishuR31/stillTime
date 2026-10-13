/**
 * Judging a screen-off probe result.
 *
 * Everything here is pure so the rules can be unit-tested without a device, and
 * so the same wording appears whether a result arrived on resume, on a manual
 * re-read, or from a restored probe the app found at launch.
 *
 * The central honesty problem: Android's `SCREEN_OFF_TIMEOUT` is a *timer*, not
 * a measurement. A write that returns `true` proves only that the value was
 * accepted by `Settings.System` — not that the device honours it. A battery
 * manager, an OEM policy or Doze can defer it. The probe exists to close that
 * gap, so the verdict must be willing to say "this did not work" plainly.
 */

import type { ScreenOffProbeResult } from '../native/types';
import type { BannerTone } from '../components/primitives';

/** Timeout the quick test writes before measuring. */
export const QUICK_TEST_MS = 15_000;

/**
 * How far a measurement may drift before it is called a mismatch.
 *
 * Both halves matter: a 15s timeout is dominated by Android's own scheduling
 * overhead (absolute), while a 1h timeout can absorb a generous relative error
 * without anyone caring.
 */
export const ABSOLUTE_TOLERANCE_MS = 2_000;
export const RELATIVE_TOLERANCE = 0.15;

export function toleranceFor(expectedMs: number): number {
  if (!Number.isFinite(expectedMs) || expectedMs <= 0) return ABSOLUTE_TOLERANCE_MS;
  return Math.max(ABSOLUTE_TOLERANCE_MS, expectedMs * RELATIVE_TOLERANCE);
}

export type ProbeVerdict =
  | 'idle'
  | 'waiting'
  | 'match'
  | 'early'
  | 'late'
  | 'invalid'
  | 'cancelled';

export interface ProbeAssessment {
  verdict: ProbeVerdict;
  tone: BannerTone;
  title: string;
  detail: string;
  /** `measured - expected`, or `null` when it could not be computed. */
  deltaMs: number | null;
  /** Tolerance that was applied, for showing the reader what "close" means. */
  toleranceMs: number | null;
}

/**
 * Measured durations need a decimal: 15s vs 15.4s is the whole point of the
 * test, and `formatDuration` rounds to whole seconds.
 */
export function formatMeasured(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;

  const totalSeconds = ms / 1_000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return seconds >= 1 ? `${minutes}m ${seconds.toFixed(1)}s` : `${minutes}m`;
}

/** Signed, human-readable difference. `0.4s later` / `1.2s earlier`. */
export function formatDelta(deltaMs: number): string {
  const magnitude = formatMeasured(Math.abs(deltaMs));
  if (Math.abs(deltaMs) < 50) return 'on the mark';
  return deltaMs > 0 ? `${magnitude} later` : `${magnitude} earlier`;
}

/** True while the probe is waiting for the screen to go dark. */
export function isProbeRunning(result: ScreenOffProbeResult | null): boolean {
  return result?.state === 'armed';
}

function assessCompleted(result: ScreenOffProbeResult): ProbeAssessment {
  const expected = result.expectedMs;
  const measured = result.measuredMs;

  if (expected === null || measured === null) {
    return {
      verdict: 'invalid',
      tone: 'warning',
      title: 'Could not compare',
      detail: 'The screen went off but the measurement was incomplete. Run the test again.',
      deltaMs: null,
      toleranceMs: null,
    };
  }

  const deltaMs = measured - expected;
  const toleranceMs = toleranceFor(expected);
  const magnitude = formatDelta(deltaMs);

  const restore = describeRestore(result);

  if (Math.abs(deltaMs) <= toleranceMs) {
    return {
      verdict: 'match',
      tone: 'success',
      title: 'The device is honouring your timeout',
      detail:
        `The screen went off after ${formatMeasured(measured)} of no input, against a ` +
        `timeout of ${formatMeasured(expected)}. That is ${magnitude}, within the ` +
        `${formatMeasured(toleranceMs)} tolerance.${restore}`,
      deltaMs,
      toleranceMs,
    };
  }

  if (deltaMs > 0) {
    return {
      verdict: 'late',
      tone: 'warning',
      title: 'The screen stayed on longer than requested',
      detail:
        `The screen went off after ${formatMeasured(measured)}, which is ${magnitude} than ` +
        `the ${formatMeasured(expected)} you asked for. Battery Saver, Doze or a manufacturer ` +
        `policy is most likely adding its own delay.${restore}`,
      deltaMs,
      toleranceMs,
    };
  }

  return {
    verdict: 'early',
    tone: 'warning',
    title: 'The screen went off sooner than requested',
    detail:
      `The screen went off after ${formatMeasured(measured)}, which is ${magnitude} than ` +
      `the ${formatMeasured(expected)} you asked for. Another app or a policy may have changed ` +
      `the setting back.${restore}`,
    deltaMs,
    toleranceMs,
  };
}

/** One sentence about the write-back, appended to a completed verdict. */
function describeRestore(result: ScreenOffProbeResult): string {
  if (result.restoreToMs === null) return '';
  if (result.restored) {
    return ` Stilltime put your previous timeout of ${formatMeasured(result.restoreToMs)} back.`;
  }
  return ` Stilltime tried to restore ${formatMeasured(result.restoreToMs)} and could not confirm it — check the current value.`;
}

export function assessProbe(result: ScreenOffProbeResult | null): ProbeAssessment {
  if (result === null) {
    return {
      verdict: 'idle',
      tone: 'info',
      title: 'No test has been run yet',
      detail:
        'Run a test and Stilltime will time how long the screen really stays on, ' +
        'instead of trusting what the settings write claimed.',
      deltaMs: null,
      toleranceMs: null,
    };
  }

  switch (result.state) {
    case 'armed':
      return {
        verdict: 'waiting',
        tone: 'info',
        title: 'Waiting for the screen to go off',
        detail:
          result.expectedMs === null
            ? 'Leave the app and do not touch the screen. The result appears when you come back.'
            : `Leave the app and do not touch the screen. Expect it to go dark in about ${formatMeasured(
                result.expectedMs,
              )}.`,
        deltaMs: null,
        toleranceMs: null,
      };

    case 'completed':
      return assessCompleted(result);

    case 'interrupted':
      return {
        verdict: 'invalid',
        tone: 'warning',
        title: 'Not measured — the screen came back on',
        detail:
          result.note.length > 0
            ? result.note
            : 'Android restarts its idle timer on any touch or key press, so this attempt ' +
              'cannot be measured. Start again and leave the phone alone.',
        deltaMs: null,
        toleranceMs: null,
      };

    case 'stale':
      return {
        verdict: 'invalid',
        tone: 'warning',
        title: 'Not measured — the app closed early',
        detail:
          result.note.length > 0
            ? result.note
            : 'Stilltime was closed or killed before the screen went off, so nothing was recorded.',
        deltaMs: null,
        toleranceMs: null,
      };

    case 'cancelled':
      return {
        verdict: 'cancelled',
        tone: 'info',
        title: 'Test cancelled',
        detail: 'Nothing was measured and nothing was changed.',
        deltaMs: null,
        toleranceMs: null,
      };

    case 'idle':
    default:
      return assessProbe(null);
  }
}

/** True only when the measurement proved the device is doing what it was told. */
export function isProbePassing(result: ScreenOffProbeResult | null): boolean {
  return assessProbe(result).verdict === 'match';
}
