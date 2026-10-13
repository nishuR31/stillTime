import {
  angleToPosition,
  DIAL_ANCHORS_MS,
  DIAL_PRESET_POSITIONS,
  msForPosition,
  pointToPosition,
  positionForMs,
  positionToAngle,
  snapPosition,
} from './dialScale';
import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS, TIMEOUT_PRESETS } from './timeouts';

describe('msForPosition', () => {
  it('maps the ends of the range exactly to the bounds', () => {
    expect(msForPosition(0)).toBeCloseTo(MIN_TIMEOUT_MS, 0);
    expect(msForPosition(1)).toBeCloseTo(MAX_TIMEOUT_MS, 0);
  });

  it('is monotonic across the whole range', () => {
    let previous = -1;
    for (let step = 0; step <= 200; step += 1) {
      const value = msForPosition(step / 200);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('never leaves the documented bounds', () => {
    for (const position of [-1, -0.2, 0, 0.33, 0.5, 0.77, 1, 1.2, 5, Number.NaN]) {
      const value = msForPosition(position);
      expect(value).toBeGreaterThanOrEqual(MIN_TIMEOUT_MS);
      expect(value).toBeLessThanOrEqual(MAX_TIMEOUT_MS);
    }
  });

  it('lands on each preset anchor', () => {
    TIMEOUT_PRESETS.forEach((preset, index) => {
      const position = DIAL_PRESET_POSITIONS[index]!;
      expect(msForPosition(position)).toBeCloseTo(preset.ms, 0);
    });
  });

  it('uses a geometric, not linear, interpolation between anchors', () => {
    // Halfway in log space between 15s and 30s should be sqrt(15s * 30s) ~ 21.2s,
    // not the arithmetic midpoint of 22.5s.
    const midpoint = msForPosition(0.5 / (DIAL_ANCHORS_MS.length - 1));
    expect(midpoint).toBeCloseTo(Math.sqrt(15_000 * 30_000), -3);
    expect(midpoint).toBeLessThan(22_500);
  });
});

describe('positionForMs', () => {
  it('inverts msForPosition', () => {
    for (let step = 0; step <= 100; step += 1) {
      const position = step / 100;
      const roundTripped = positionForMs(msForPosition(position));
      // `clampTimeout` rounds to whole milliseconds, which costs a few parts
      // per million of position precision.
      expect(roundTripped).toBeCloseTo(position, 4);
    }
  });

  it('places every anchor at a distinct, ordered position', () => {
    const positions = DIAL_ANCHORS_MS.map(positionForMs);
    expect(positions[0]).toBeCloseTo(0, 6);
    expect(positions[positions.length - 1]).toBeCloseTo(1, 6);
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]!).toBeGreaterThan(positions[index - 1]!);
    }
  });

  it('clamps values outside the bounds', () => {
    expect(positionForMs(1)).toBeCloseTo(0, 6);
    expect(positionForMs(10_000_000)).toBeCloseTo(1, 6);
  });
});

describe('snapPosition', () => {
  it('snaps a position close to an anchor', () => {
    const anchor = DIAL_PRESET_POSITIONS[3]!;
    expect(snapPosition(anchor + 0.001)).toBeCloseTo(anchor, 6);
  });

  it('leaves a position well away from any anchor alone', () => {
    const midway = 0.5 * (DIAL_PRESET_POSITIONS[2]! + DIAL_PRESET_POSITIONS[3]!);
    expect(snapPosition(midway)).toBeCloseTo(midway, 6);
  });
});

describe('angles', () => {
  it('starts at 12 o’clock and runs clockwise', () => {
    expect(angleToPosition(-Math.PI / 2)).toBeCloseTo(0, 6); // up
    expect(angleToPosition(0)).toBeCloseTo(0.25, 6); // right
    expect(angleToPosition(Math.PI / 2)).toBeCloseTo(0.5, 6); // down
    expect(angleToPosition(Math.PI)).toBeCloseTo(0.75, 6); // left
  });

  it('round-trips position and angle', () => {
    for (const position of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(angleToPosition(positionToAngle(position))).toBeCloseTo(position, 6);
    }
  });

  it('handles the angle discontinuity at 12 o’clock', () => {
    // -PI/2 and 3PI/2 are the same direction; both must land on position 0.
    expect(angleToPosition(-Math.PI / 2)).toBeCloseTo(0, 6);
    expect(angleToPosition((3 * Math.PI) / 2)).toBeCloseTo(0, 6);
  });

  it('maps a touch point on the dial ring', () => {
    const size = 200;
    const centre = size / 2;
    expect(pointToPosition(centre, 0, size)).toBeCloseTo(0, 6); // top
    expect(pointToPosition(size, centre, size)).toBeCloseTo(0.25, 6); // right
    expect(pointToPosition(centre, size, size)).toBeCloseTo(0.5, 6); // bottom
    expect(pointToPosition(0, centre, size)).toBeCloseTo(0.75, 6); // left
  });
});