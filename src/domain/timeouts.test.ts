import {
  clampTimeout,
  describeDuration,
  findPreset,
  formatDuration,
  isWithinBounds,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  NICE_LADDER_MS,
  stepTimeout,
  TIMEOUT_PRESETS,
} from './timeouts';

describe('bounds', () => {
  it('accepts the documented range', () => {
    expect(isWithinBounds(MIN_TIMEOUT_MS)).toBe(true);
    expect(isWithinBounds(MAX_TIMEOUT_MS)).toBe(true);
    expect(isWithinBounds(15_000)).toBe(true);
  });

  it('rejects values outside the range and non-numbers', () => {
    expect(isWithinBounds(MIN_TIMEOUT_MS - 1)).toBe(false);
    expect(isWithinBounds(MAX_TIMEOUT_MS + 1)).toBe(false);
    expect(isWithinBounds(Number.NaN)).toBe(false);
    expect(isWithinBounds(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('clamps into the range', () => {
    expect(clampTimeout(0)).toBe(MIN_TIMEOUT_MS);
    expect(clampTimeout(-5_000)).toBe(MIN_TIMEOUT_MS);
    expect(clampTimeout(Number.MAX_SAFE_INTEGER)).toBe(MAX_TIMEOUT_MS);
    expect(clampTimeout(Number.NaN)).toBe(MIN_TIMEOUT_MS);
    expect(clampTimeout(60_000)).toBe(60_000);
  });
});

describe('presets', () => {
  it('exposes exactly the eight documented presets in ascending order', () => {
    expect(TIMEOUT_PRESETS.map((preset) => preset.label)).toEqual([
      '15s',
      '30s',
      '1m',
      '2m',
      '5m',
      '10m',
      '15m',
      '30m',
    ]);

    const values = TIMEOUT_PRESETS.map((preset) => preset.ms);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps every preset inside the dial bounds', () => {
    for (const preset of TIMEOUT_PRESETS) {
      expect(isWithinBounds(preset.ms)).toBe(true);
    }
  });

  it('finds a preset by exact value only', () => {
    expect(findPreset(300_000)?.label).toBe('5m');
    expect(findPreset(299_999)).toBeUndefined();
  });
});

describe('stepTimeout', () => {
  it('steps up to the next ladder entry', () => {
    expect(stepTimeout(30_000, 1)).toBe(45_000);
    expect(stepTimeout(15_000, 1)).toBe(30_000);
  });

  it('steps down to the previous ladder entry', () => {
    expect(stepTimeout(60_000, -1)).toBe(45_000);
    expect(stepTimeout(30_000, -1)).toBe(15_000);
  });

  it('does not step past the bounds', () => {
    expect(stepTimeout(MIN_TIMEOUT_MS, -1)).toBe(MIN_TIMEOUT_MS);
    expect(stepTimeout(MAX_TIMEOUT_MS, 1)).toBe(MAX_TIMEOUT_MS);
  });

  it('is monotonic along the ladder', () => {
    for (let index = 1; index < NICE_LADDER_MS.length; index += 1) {
      const lower = NICE_LADDER_MS[index - 1]!;
      const upper = NICE_LADDER_MS[index]!;
      expect(upper).toBeGreaterThan(lower);
      expect(stepTimeout(lower, 1)).toBe(upper);
    }
  });
});

describe('formatDuration', () => {
  it.each([
    [15_000, '15s'],
    [30_000, '30s'],
    [59_000, '59s'],
    [60_000, '1m'],
    [90_000, '1m 30s'],
    [120_000, '2m'],
    [3_600_000, '1h'],
    [5_400_000, '1h 30m'],
  ])('formats %ims as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it('renders a placeholder for invalid input', () => {
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
  });
});

describe('describeDuration', () => {
  it('spells out units for screen readers', () => {
    expect(describeDuration(15_000)).toBe('15 seconds');
    expect(describeDuration(60_000)).toBe('1 minute');
    expect(describeDuration(300_000)).toBe('5 minutes');
    expect(describeDuration(3_600_000)).toBe('1 hour');
    expect(describeDuration(7_200_000)).toBe('2 hours');
  });
});