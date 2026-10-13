/**
 * Typed contract with `StilltimeTimeout` (the Kotlin Expo module).
 *
 * Every shape here mirrors a Kotlin `Map<String, Any?>` produced by
 * `StilltimeTimeoutModule.kt`. Keep the two files in sync.
 */

export interface PermissionSnapshot {
  /** `Settings.System.canWrite(context)` — the "Modify system settings" grant. */
  canWrite: boolean;
  sdkInt: number;
}

export interface TimeoutSnapshot {
  /** Live value from `Settings.System.SCREEN_OFF_TIMEOUT`. */
  observedMs: number;
  /** What the user asked for, echoed back. */
  requestedMs: number;
  /** What we read back after writing. */
  appliedMs: number;
  /** `observedMs === appliedMs` after a write. */
  verified: boolean;
  canWrite: boolean;
  /** True when `observedMs` is outside Stilltime's dial bounds. */
  outsideDialBounds: boolean;
  /** Android SDK int. */
  sdkInt: number;
  /** Manufacturer string, for OEM hints. */
  manufacturer: string;
}

export interface PowerSnapshot {
  powerSaveMode: boolean;
  deviceIdleMode: boolean;
  ignoringBatteryOptimizations: boolean;
  sdkInt: number;
  manufacturer: string;
}

export interface StayAwakeState {
  active: boolean;
  /** Epoch ms when the session started, or `null`. */
  startedAt: number | null;
  /** Timeout before the session, or `null`. */
  originalMs: number | null;
  /** What we applied, or `null`. */
  appliedMs: number | null;
  /** Live value observed at read time, or `null`. */
  observedMs: number | null;
  /** `true` when the live value no longer matches `appliedMs`. */
  drifted: boolean;
  /** Milliseconds until the session naturally lapses, or `null`. */
  remainingMs: number | null;
}

export interface ApplyResult {
  snapshot: TimeoutSnapshot;
  stayAwake: StayAwakeState;
}

export interface StopStayAwakeResult {
  /** The timeout that was written, or `null` when we refused to write. */
  restoredMs: number | null;
  /** True when we deliberately skipped restoring. */
  skipped: boolean;
  /** True when the session is now inactive. */
  inactive: boolean;
  snapshot: TimeoutSnapshot;
  stayAwake: StayAwakeState;
}

export interface ModuleConstants {
  minTimeoutMs: number;
  maxTimeoutMs: number;
  stayAwakeTimeoutMs: number;
  presets: readonly { id: string; label: string; ms: number }[];
  /** `versionName` from the installed package. */
  appVersion: string;
  /** `versionCode` from the installed package. */
  buildNumber: number;
}

/**
 * State of the screen-off probe.
 *
 *   - `idle`        nothing has been run yet
 *   - `armed`       measuring, waiting for the screen to go dark
 *   - `completed`   the screen went off and was timed
 *   - `interrupted` the screen came back on first, so Android restarted its
 *                   idle timer and the attempt is meaningless
 *   - `stale`       the process died before the screen went off
 *   - `cancelled`   the user backed out
 */
export type ScreenOffProbeState =
  | 'idle'
  | 'armed'
  | 'completed'
  | 'interrupted'
  | 'stale'
  | 'cancelled';

export interface ScreenOffProbeResult {
  state: ScreenOffProbeState;
  /** Timeout the measurement is compared against (ms). */
  expectedMs: number | null;
  /** Real idle-to-screen-off time in ms, from `SystemClock.elapsedRealtime`. */
  measuredMs: number | null;
  /** Wall-clock ms when the screen went off, for display only. */
  screenOffAtWallMs: number | null;
  /** Wall-clock ms when the screen came back on, for display only. */
  screenOnAtWallMs: number | null;
  /** Wall-clock ms when the probe was armed. */
  armedAtWallMs: number | null;
  /** Timeout that was written back on screen-off, when one was requested. */
  restoreToMs: number | null;
  /** Whether that write-back verified. */
  restored: boolean;
  /** Extra context from the native side, or an empty string. */
  note: string;
}


/** Stable error codes mirrored from `StilltimeErrors.kt`. */
export const STILLTIME_ERROR_CODES = [
  'E_PERMISSION_REQUIRED',
  'E_OUT_OF_RANGE',
  'E_WRITE_FAILED',
  'E_VERIFY_FAILED',
  'E_NOTHING_TO_RESTORE',
  'E_UNSUPPORTED_PLATFORM',
  'E_INTERNAL',
] as const;

export type StilltimeErrorCode = (typeof STILLTIME_ERROR_CODES)[number];