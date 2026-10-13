import {
  ABSOLUTE_TOLERANCE_MS,
  assessProbe,
  formatDelta,
  formatMeasured,
  isProbePassing,
  isProbeRunning,
  toleranceFor,
} from './screenOffProbe';
import type { ScreenOffProbeResult } from '../native/types';
import { idleProbe } from '../test-support/fakeNativeClient';

function probe(overrides: Partial<ScreenOffProbeResult>): ScreenOffProbeResult {
  return { ...idleProbe(), ...overrides };
}

function completed(measuredMs: number, expectedMs = 15_000): ScreenOffProbeResult {
  return probe({ state: 'completed', expectedMs, measuredMs });
}

describe('toleranceFor', () => {
  it('uses whichever of the two floors is larger', () => {
    // 15s * 0.15 = 2.25s, which beats the 2s absolute floor.
    expect(toleranceFor(15_000)).toBe(2_250);
    // 10s * 0.15 = 1.5s, so the absolute floor wins here.
    expect(toleranceFor(10_000)).toBe(ABSOLUTE_TOLERANCE_MS);
  });

  it('scales with the expected timeout once the relative term wins', () => {
    expect(toleranceFor(60_000)).toBe(9_000);
    expect(toleranceFor(3_600_000)).toBe(540_000);
  });

  it('falls back to the floor for nonsense input', () => {
    expect(toleranceFor(0)).toBe(ABSOLUTE_TOLERANCE_MS);
    expect(toleranceFor(Number.NaN)).toBe(ABSOLUTE_TOLERANCE_MS);
  });
});

describe('formatMeasured', () => {
  it('keeps one decimal below a minute, because that is the whole point', () => {
    expect(formatMeasured(15_000)).toBe('15.0s');
    expect(formatMeasured(15_400)).toBe('15.4s');
  });

  it('splits minutes and seconds above a minute', () => {
    expect(formatMeasured(90_400)).toBe('1m 30.4s');
  });

  it('drops a sub-second remainder when rounding would show nothing', () => {
    expect(formatMeasured(120_000)).toBe('2m');
  });

  it('refuses to render nonsense', () => {
    expect(formatMeasured(Number.NaN)).toBe('—');
    expect(formatMeasured(-1)).toBe('—');
  });
});

describe('formatDelta', () => {
  it('describes direction', () => {
    expect(formatDelta(1_400)).toBe('1.4s later');
    expect(formatDelta(-1_200)).toBe('1.2s earlier');
  });

  it('collapses anything under 50ms to "on the mark"', () => {
    expect(formatDelta(0)).toBe('on the mark');
    expect(formatDelta(-30)).toBe('on the mark');
  });
});

describe('assessProbe', () => {
  it('has something useful to say before anything has been run', () => {
    const assessment = assessProbe(null);
    expect(assessment.verdict).toBe('idle');
    expect(assessment.title.length).toBeGreaterThan(0);
  });

  it('treats a null result the same as an idle one', () => {
    expect(assessProbe(idleProbe()).verdict).toBe('idle');
  });

  it('passes a measurement inside the tolerance', () => {
    // 15.4s measured against a 15s timeout: +400ms, inside the 2s floor.
    const assessment = assessProbe(completed(15_400));
    expect(assessment.verdict).toBe('match');
    expect(assessment.tone).toBe('success');
    expect(assessment.deltaMs).toBe(400);
  });

  it('flags a screen that stays on longer than asked', () => {
    // 25s measured against a 15s timeout: +10s, outside the 2s floor.
    const assessment = assessProbe(completed(25_000));
    expect(assessment.verdict).toBe('late');
    expect(assessment.tone).toBe('warning');
    expect(assessment.deltaMs).toBe(10_000);
    expect(assessment.detail).toContain('Battery Saver');
  });

  it('flags a screen that goes off sooner than asked', () => {
    const assessment = assessProbe(completed(8_000));
    expect(assessment.verdict).toBe('early');
    expect(assessment.deltaMs).toBe(-7_000);
  });

  it('scales the tolerance so a long timeout is not judged harshly', () => {
    // 1h expected, +4 minutes late: within the 9-minute relative tolerance.
    expect(assessProbe(completed(3_840_000, 3_600_000)).verdict).toBe('match');
    // ...but +15 minutes is not.
    expect(assessProbe(completed(4_500_000, 3_600_000)).verdict).toBe('late');
  });

  it('refuses to compare an incomplete measurement', () => {
    const assessment = assessProbe(probe({ state: 'completed', expectedMs: 15_000, measuredMs: null }));
    expect(assessment.verdict).toBe('invalid');
    expect(assessment.deltaMs).toBeNull();
  });

  it('explains an interrupted run instead of reporting a wrong number', () => {
    const assessment = assessProbe(probe({ state: 'interrupted', measuredMs: 4_000 }));
    expect(assessment.verdict).toBe('invalid');
    expect(assessment.deltaMs).toBeNull();
    expect(assessment.detail).toContain('idle timer');
  });

  it('falls back to its own wording when the native note is empty', () => {
    const assessment = assessProbe(probe({ state: 'stale' }));
    expect(assessment.verdict).toBe('invalid');
    expect(assessment.detail.length).toBeGreaterThan(0);
  });

  it('reports a cancelled run as harmless', () => {
    expect(assessProbe(probe({ state: 'cancelled' })).verdict).toBe('cancelled');
  });

  it('mentions a successful restore in the verdict', () => {
    const assessment = assessProbe(
      completed(15_300, 15_000),
    );
    expect(assessment.detail).not.toContain('restore');

    const withRestore = assessProbe(
      probe({ state: 'completed', expectedMs: 15_000, measuredMs: 15_300, restoreToMs: 300_000, restored: true }),
    );
    expect(withRestore.detail).toContain('5m back');
  });

  it('warns when a requested restore could not be confirmed', () => {
    const assessment = assessProbe(
      probe({
        state: 'completed',
        expectedMs: 15_000,
        measuredMs: 15_300,
        restoreToMs: 300_000,
        restored: false,
      }),
    );
    expect(assessment.detail).toContain('could not confirm');
  });
});

describe('helpers', () => {
  it('recognises a running probe', () => {
    expect(isProbeRunning(probe({ state: 'armed' }))).toBe(true);
    expect(isProbeRunning(completed(15_000))).toBe(false);
    expect(isProbeRunning(null)).toBe(false);
  });

  it('treats only a verified match as passing', () => {
    expect(isProbePassing(completed(15_300))).toBe(true);
    expect(isProbePassing(completed(25_000))).toBe(false);
    expect(isProbePassing(null)).toBe(false);
  });
});
