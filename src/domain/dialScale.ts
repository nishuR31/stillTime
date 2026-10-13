/**
 * Bounded, piecewise scale mapping a dial position to a timeout.
 *
 * A linear mapping would make the entire 15s..1h range unusable: 15 seconds of
 * the arc would cover 99.6% of it. Instead the scale is anchored on the eight
 * presets and interpolates *geometrically* between adjacent anchors, so each
 * preset receives an equal share of the arc and each doubling of duration
 * receives a comparable amount of travel.
 *
 * The scale is closed: `positionForMs(clampTimeout(ms))` always returns a value
 * in [0, 1], and `msForPosition` always returns a value within
 * [MIN_TIMEOUT_MS, MAX_TIMEOUT_MS].
 */

import { clampTimeout, MAX_TIMEOUT_MS, MIN_TIMEOUT_MS, TIMEOUT_PRESETS } from './timeouts';

/** Scale anchors in ms. Strictly increasing. First and last are the bounds. */
const ANCHORS_MS: readonly number[] = Object.freeze([
  MIN_TIMEOUT_MS, // 15s
  30_000,
  60_000, // 1m
  120_000, // 2m
  300_000, // 5m
  600_000, // 10m
  900_000, // 15m
  1_800_000, // 30m
  MAX_TIMEOUT_MS, // 1h
]);

const LOG_ANCHORS = ANCHORS_MS.map((ms) => Math.log(ms));

const FIRST_SEGMENT = 1 / (ANCHORS_MS.length - 1);
const LAST_SEGMENT = 1 - FIRST_SEGMENT;

export const DIAL_ANCHORS_MS = ANCHORS_MS;
export const DIAL_PRESET_POSITIONS: readonly number[] = Object.freeze(
  TIMEOUT_PRESETS.map((preset) => indexOfAnchor(preset.ms)),
);

function indexOfAnchor(ms: number): number {
  const index = ANCHORS_MS.indexOf(ms);
  if (index < 0) {
    throw new Error(`Dial scale anchor not found for ${ms}ms. Update ANCHORS_MS or the presets.`);
  }
  return index / (ANCHORS_MS.length - 1);
}

export function clampPosition(position: number): number {
  if (!Number.isFinite(position)) return 0;
  return Math.min(1, Math.max(0, position));
}

/** Map a dial position in [0, 1] to a timeout in ms. */
export function msForPosition(position: number): number {
  const t = clampPosition(position);

  if (t <= FIRST_SEGMENT) {
    return interpolateGeometric(LOG_ANCHORS[0]!, LOG_ANCHORS[1]!, t / FIRST_SEGMENT);
  }
  if (t >= LAST_SEGMENT) {
    return interpolateGeometric(
      LOG_ANCHORS[ANCHORS_MS.length - 2]!,
      LOG_ANCHORS[ANCHORS_MS.length - 1]!,
      (t - LAST_SEGMENT) / FIRST_SEGMENT,
    );
  }

  const scaled = t * (ANCHORS_MS.length - 1);
  const lower = Math.floor(scaled);
  const upper = lower + 1;
  return interpolateGeometric(LOG_ANCHORS[lower]!, LOG_ANCHORS[upper]!, scaled - lower);
}

/** Map a timeout in ms to a dial position in [0, 1]. */
export function positionForMs(ms: number): number {
  const clamped = clampTimeout(ms);
  const logValue = Math.log(clamped);

  for (let index = 0; index < LOG_ANCHORS.length - 1; index += 1) {
    const lower = LOG_ANCHORS[index]!;
    const upper = LOG_ANCHORS[index + 1]!;
    if (logValue <= upper) {
      const segmentFraction = (logValue - lower) / (upper - lower);
      return (index + segmentFraction) / (ANCHORS_MS.length - 1);
    }
  }
  return 1;
}

function interpolateGeometric(lowerLog: number, upperLog: number, fraction: number): number {
  return Math.exp(lowerLog + (upperLog - lowerLog) * fraction);
}

/**
 * Snap an arbitrary position to the nearest anchor when it is close enough to
 * feel like a detent. Gives the dial a tactile, non-sludgy feel without
 * forcing discrete jumps everywhere.
 */
export function snapPosition(position: number, tolerance = 0.012): number {
  const t = clampPosition(position);
  let bestPosition = t;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < ANCHORS_MS.length; index += 1) {
    const anchorPosition = index / (ANCHORS_MS.length - 1);
    const distance = Math.abs(anchorPosition - t);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPosition = anchorPosition;
    }
  }

  return bestDistance <= tolerance ? bestPosition : t;
}

/**
 * Convert a PanResponder touch point (relative to the dial's top-left corner)
 * into a dial position. The dial is square, so `dialSize` is both the width and
 * the height.
 */
export function pointToPosition(x: number, y: number, dialSize: number): number {
  if (dialSize <= 0) return 0;
  return angleToPosition(Math.atan2(y - dialSize / 2, x - dialSize / 2));
}

/**
 * Map a dial angle in radians (the convention `Math.atan2` returns) to a
 * position in [0, 1].
 *
 * Straight up (12 o'clock) is `-PI/2` and maps to position 0. Turning clockwise
 * increases the position, so "more time" is always to the right.
 */
export function angleToPosition(radians: number): number {
  return wrapRadians(radians + Math.PI / 2) / (Math.PI * 2);
}

/** Inverse of `angleToPosition`. */
export function positionToAngle(position: number): number {
  return clampPosition(position) * Math.PI * 2 - Math.PI / 2;
}

/** Wrap radians into [0, 2π). */
function wrapRadians(radians: number): number {
  const wrapped = radians % (Math.PI * 2);
  return wrapped < 0 ? wrapped + Math.PI * 2 : wrapped;
}