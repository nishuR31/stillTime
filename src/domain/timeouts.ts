/**
 * Timeout domain: bounds, presets, and human formatting.
 *
 * The dial, the presets grid, the widget, and the native module all agree on
 * these numbers. `MIN_TIMEOUT_MS` is deliberately higher than Android's own
 * floor (1000 ms) because anything below 15 seconds is uncomfortable to use and
 * most OEM skins clamp aggressively anyway.
 */

export const MIN_TIMEOUT_MS = 15_000;
export const MAX_TIMEOUT_MS = 3_600_000;

/** The eight presets shown in the app, in dial order. */
export const TIMEOUT_PRESETS = [
  { id: 'p15s', label: '15s', ms: 15_000 },
  { id: 'p30s', label: '30s', ms: 30_000 },
  { id: 'p1m', label: '1m', ms: 60_000 },
  { id: 'p2m', label: '2m', ms: 120_000 },
  { id: 'p5m', label: '5m', ms: 300_000 },
  { id: 'p10m', label: '10m', ms: 600_000 },
  { id: 'p15m', label: '15m', ms: 900_000 },
  { id: 'p30m', label: '30m', ms: 1_800_000 },
] as const;

export type TimeoutPresetId = (typeof TIMEOUT_PRESETS)[number]['id'];
export type TimeoutPreset = (typeof TIMEOUT_PRESETS)[number];

/**
 * Finer ladder used for +/- stepping and for the widget.
 *
 * Every entry lies inside [MIN_TIMEOUT_MS, MAX_TIMEOUT_MS]; a step can never
 * leave the dial's range.
 */
export const NICE_LADDER_MS = [
  15_000, 30_000, 45_000, 60_000, 90_000, 120_000, 180_000, 300_000, 420_000, 600_000, 900_000,
  1_200_000, 1_800_000, 2_700_000, 3_600_000,
] as const;

/** Quick values offered by the widget, which has room for four. */
export const WIDGET_PRESET_MS = [30_000, 60_000, 300_000, 900_000] as const;

export function clampTimeout(ms: number): number {
  if (!Number.isFinite(ms)) return MIN_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(ms)));
}

export function isWithinBounds(ms: number): boolean {
  return Number.isFinite(ms) && ms >= MIN_TIMEOUT_MS && ms <= MAX_TIMEOUT_MS;
}

export function findPreset(ms: number): TimeoutPreset | undefined {
  return TIMEOUT_PRESETS.find((preset) => preset.ms === ms);
}

/**
 * Move to the next/previous entry on the nice ladder, clamped to the dial's
 * range so a step can never leave the supported bounds.
 */
export function stepTimeout(ms: number, direction: 1 | -1): number {
  const current = clampTimeout(ms);

  if (direction === 1) {
    for (const candidate of NICE_LADDER_MS) {
      if (candidate > current) return candidate;
    }
    return MAX_TIMEOUT_MS;
  }

  for (let index = NICE_LADDER_MS.length - 1; index >= 0; index -= 1) {
    const candidate = NICE_LADDER_MS[index]!;
    if (candidate < current) return candidate;
  }
  return MIN_TIMEOUT_MS;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * Compact, unambiguous duration formatting.
 *
 *   15_000 -> "15s"      90_000 -> "1m 30s"
 *   300_000 -> "5m"     3_600_000 -> "1h"
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';

  if (ms < MINUTE) {
    const seconds = Math.round(ms / SECOND);
    return seconds <= 0 ? '0s' : `${seconds}s`;
  }

  if (ms < HOUR) {
    const totalMinutes = Math.floor(ms / MINUTE);
    const seconds = Math.round((ms - totalMinutes * MINUTE) / SECOND);
    const minutes = Math.floor(totalMinutes / 60);
    const remainderMinutes = totalMinutes % 60;
    const minutePart = minutes > 0 ? `${minutes}h` : '';
    const remainderPart = remainderMinutes > 0 ? `${remainderMinutes}m` : '';
    const joined = `${minutePart}${remainderPart}`;
    if (seconds > 0) return `${joined} ${seconds}s`;
    return joined.length > 0 ? joined : '0m';
  }

  const hours = Math.floor(ms / HOUR);
  const minutes = Math.round((ms - hours * HOUR) / MINUTE);
  if (minutes > 0 && hours < 24) return `${hours}h ${minutes}m`;
  return `${hours}h`;
}

/** Spoken form for screen readers, where "5m" is ambiguous. */
export function describeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown duration';
  if (ms < MINUTE) return `${Math.round(ms / SECOND)} seconds`;
  if (ms < HOUR) {
    const minutes = Math.round(ms / MINUTE);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(ms / HOUR);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/** Values Android may store that Stilltime refuses to display on the dial. */
export function isDisplayableTimeout(ms: number | null | undefined): ms is number {
  return typeof ms === 'number' && isWithinBounds(ms);
}