/**
 * The single place that talks to the native `StilltimeTimeout` module.
 *
 * This is the only file that imports `expo-modules-core`. Every call is
 * validated before it crosses the bridge and every throw is normalised into a
 * `StilltimeError`.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { NativeModules, Platform } from 'react-native';

import { clampTimeout, isWithinBounds, TIMEOUT_PRESETS } from '../domain/timeouts';
import { clampStayAwakeRequest } from '../domain/stayAwake';
import { StilltimeError, toStilltimeError } from './errors';
import type { StilltimeClient } from './client';
import type {
  ApplyResult,
  ModuleConstants,
  PermissionSnapshot,
  PowerSnapshot,
  ScreenOffProbeResult,
  StayAwakeState,
  StopStayAwakeResult,
  TimeoutSnapshot,
} from './types';

const MODULE_NAME = 'StilltimeTimeout';

/**
 * Shape of the Kotlin module as seen from JS.
 *
 * Most Kotlin `Function(...)` declarations are synchronous and return a
 * `Map<String, Any?>`. `await`-ing a plain object is a no-op, so the promise
 * signatures below stay accurate from the caller's point of view.
 *
 * `Constant(...)` entries are exported by the Expo Modules JSI host as plain
 * read-only *properties*, not behind a `getConstants()` accessor — hence the
 * fields below rather than a method.
 */
interface StilltimeTimeoutNative {
  minTimeoutMs: number;
  maxTimeoutMs: number;
  stayAwakeTimeoutMs: number;
  presets: ModuleConstants['presets'];
  appVersion: string;
  buildNumber: number;

  getPermissionState(): Promise<PermissionSnapshot>;
  requestWritePermission(): Promise<PermissionSnapshot>;
  getTimeoutSnapshot(requestedMs?: number): Promise<TimeoutSnapshot>;
  applyTimeout(requestedMs: number): Promise<ApplyResult>;
  getPowerState(): Promise<PowerSnapshot>;
  getStayAwakeState(): Promise<StayAwakeState>;
  startStayAwake(requestedMs: number): Promise<ApplyResult>;
  stopStayAwake(): Promise<StopStayAwakeResult>;
  reconcileStayAwake(): Promise<StayAwakeState>;
  openBatterySettings(): Promise<void>;
  openWriteSettings(): Promise<void>;
  notifyWidgets(timeoutMs: number): void;
  startScreenOffProbe(expectedMs: number, restoreToMs: number | null): Promise<ScreenOffProbeResult>;
  getScreenOffProbe(): Promise<ScreenOffProbeResult>;
  cancelScreenOffProbe(): Promise<ScreenOffProbeResult>;

  /** Legacy bridge shape. Present only on the `NativeModules` fallback path. */
  getConstants?: () => ModuleConstants;
}

/**
 * Values used before the module answers, and whenever it is unavailable.
 *
 * Mirrors `StilltimeWidgetContract.kt`; `src/native/widgetContract.test.ts`
 * asserts the three copies agree.
 */
const FALLBACK_CONSTANTS: ModuleConstants = {
  minTimeoutMs: 15_000,
  maxTimeoutMs: 3_600_000,
  stayAwakeTimeoutMs: 30 * 60 * 1000,
  presets: TIMEOUT_PRESETS,
  appVersion: 'unknown',
  buildNumber: 0,
};


/**
 * Resolve the native module.
 *
 * Expo Modules are **not** published on React Native's `NativeModules`: the
 * Kotlin class is an `expo.modules.kotlin.modules.Module`, which the Expo
 * Modules installer registers on the JSI host object `globalThis.expo.modules`.
 * Reading `NativeModules[MODULE_NAME]` therefore always yields `undefined` and
 * makes a perfectly good release build report "Native module unavailable".
 *
 * `requireOptionalNativeModule` is the supported lookup and returns `null`
 * rather than throwing when the module is absent (Expo Go, iOS, tests). The
 * `NativeModules` lookup is kept as a fallback for the legacy bridge.
 */
function loadNativeModule(): StilltimeTimeoutNative | null {
  try {
    const expoModule = requireOptionalNativeModule<StilltimeTimeoutNative | null>(MODULE_NAME);
    if (expoModule) return expoModule;
  } catch {
    // Fall through to the legacy bridge below.
  }
  return (NativeModules[MODULE_NAME] as StilltimeTimeoutNative | undefined) ?? null;
}

const native = loadNativeModule();

export const isNativeAvailable = native !== null && Platform.OS === 'android';

function requireNative(): StilltimeTimeoutNative {
  if (!isNativeAvailable || !native) {
    throw new StilltimeError(
      'E_UNSUPPORTED_PLATFORM',
      `Native module "${MODULE_NAME}" is unavailable on ${Platform.OS}. ` +
        'Stilltime requires an Android development build or APK; it does not run in Expo Go.',
      'Build the Android app with `bun run prebuild` followed by `bun run android`.',
    );
  }
  return native;
}

function assertInRange(ms: number, code: 'E_OUT_OF_RANGE' = 'E_OUT_OF_RANGE'): void {
  if (!isWithinBounds(ms)) {
    throw new StilltimeError(
      code,
      `Timeout ${ms}ms is outside the supported range 15000..3600000ms.`,
      'Pick a time between 15 seconds and 1 hour.',
    );
  }
}

async function guard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    throw toStilltimeError(cause);
  }
}

// -------------------------------------------------------------------------
// Permission
// -------------------------------------------------------------------------

export async function getPermissionState(): Promise<PermissionSnapshot> {
  return guard(() => requireNative().getPermissionState());
}

/**
 * Open the system "Modify system settings" page for this app.
 *
 * Resolves with the fresh permission state. Android does not grant the
 * permission automatically, so the result may still be `canWrite: false`.
 */
export async function requestWritePermission(): Promise<PermissionSnapshot> {
  return guard(() => requireNative().requestWritePermission());
}

export async function openWriteSettings(): Promise<void> {
  return guard(() => requireNative().openWriteSettings());
}

export async function openBatterySettings(): Promise<void> {
  return guard(() => requireNative().openBatterySettings());
}

// -------------------------------------------------------------------------
// Timeout
// -------------------------------------------------------------------------

export async function getTimeoutSnapshot(requestedMs?: number): Promise<TimeoutSnapshot> {
  const requested = requestedMs === undefined ? undefined : clampTimeout(requestedMs);
  return guard(() => requireNative().getTimeoutSnapshot(requested));
}

/**
 * Write the timeout and verify it by reading it back.
 *
 * Rejects with `E_PERMISSION_REQUIRED`, `E_OUT_OF_RANGE`, `E_WRITE_FAILED`, or
 * `E_VERIFY_FAILED`. It never resolves with `verified: false`.
 */
export async function applyTimeout(requestedMs: number): Promise<ApplyResult> {
  assertInRange(requestedMs);
  return guard(() => requireNative().applyTimeout(clampTimeout(requestedMs)));
}

// -------------------------------------------------------------------------
// Power diagnostics
// -------------------------------------------------------------------------

export async function getPowerState(): Promise<PowerSnapshot> {
  return guard(() => requireNative().getPowerState());
}

// -------------------------------------------------------------------------
// Stay Awake
// -------------------------------------------------------------------------

export async function getStayAwakeState(): Promise<StayAwakeState> {
  return guard(() => requireNative().getStayAwakeState());
}

export async function startStayAwake(requestedMs?: number): Promise<ApplyResult> {
  const requested = clampStayAwakeRequest(requestedMs ?? getConstants().stayAwakeTimeoutMs);
  return guard(() => requireNative().startStayAwake(requested));
}

export async function stopStayAwake(): Promise<StopStayAwakeResult> {
  return guard(() => requireNative().stopStayAwake());
}

/**
 * Idempotent recovery, safe to call on every foreground.
 *
 * Never writes anything. It only refreshes what we last applied and reports
 * whether the live value still matches, so a stale session can be detected and
 * surfaced instead of blindly re-applied.
 */
export async function reconcileStayAwake(): Promise<StayAwakeState> {
  return guard(() => requireNative().reconcileStayAwake());
}

// -------------------------------------------------------------------------
// Widget bridge
// -------------------------------------------------------------------------

/**
 * Tell every placed widget to redraw. Fire-and-forget: the app works fine if
 * no widget exists, and widget failures must never surface to the user.
 */
export function notifyWidgets(timeoutMs: number): void {
  if (!isNativeAvailable || !native) return;
  try {
    native.notifyWidgets(clampTimeout(timeoutMs));
  } catch {
    // A widget that cannot be updated is not an app error.
  }
}

/**
 * Read the module's `Constant(...)` entries.
 *
 * Prefer the properties the JSI host exposes; fall back to `getConstants()` for
 * the legacy bridge shape, and to the documented defaults if neither is usable.
 */function readConstants(module: StilltimeTimeoutNative): ModuleConstants {
  const legacy = typeof module.getConstants === 'function' ? module.getConstants() : undefined;

  return {
    minTimeoutMs: module.minTimeoutMs ?? legacy?.minTimeoutMs ?? FALLBACK_CONSTANTS.minTimeoutMs,
    maxTimeoutMs: module.maxTimeoutMs ?? legacy?.maxTimeoutMs ?? FALLBACK_CONSTANTS.maxTimeoutMs,
    stayAwakeTimeoutMs:
      module.stayAwakeTimeoutMs ??
      legacy?.stayAwakeTimeoutMs ??
      FALLBACK_CONSTANTS.stayAwakeTimeoutMs,
    presets: module.presets ?? legacy?.presets ?? FALLBACK_CONSTANTS.presets,
    appVersion: module.appVersion ?? legacy?.appVersion ?? FALLBACK_CONSTANTS.appVersion,
    buildNumber: module.buildNumber ?? legacy?.buildNumber ?? FALLBACK_CONSTANTS.buildNumber,
  };
}

export function getConstants(): ModuleConstants {
  return native ? readConstants(native) : FALLBACK_CONSTANTS;
}

// -------------------------------------------------------------------------
// Screen-off probe
// -------------------------------------------------------------------------

/**
 * Start timing how long the screen really stays on.
 *
 * `expectedMs` is the timeout currently on the device — the value the
 * measurement will be judged against. Pass `restoreToMs` and the native side
 * writes that value back the instant the screen goes dark, so a quick test
 * never leaves a short timeout behind if the app is killed mid-run.
 *
 * Returns immediately. The result arrives later, via `getScreenOffProbe()`.
 */
export async function startScreenOffProbe(
  expectedMs: number,
  restoreToMs: number | null = null,
): Promise<ScreenOffProbeResult> {
  assertInRange(expectedMs);
  return guard(() => requireNative().startScreenOffProbe(expectedMs, restoreToMs));
}

/**
 * Read the probe. Never writes anything, so it is safe to call on every
 * foreground and on every render of the testing screen.
 */
export async function getScreenOffProbe(): Promise<ScreenOffProbeResult> {
  return guard(() => requireNative().getScreenOffProbe());
}

/** Stop an armed probe and mark it cancelled. */
export async function cancelScreenOffProbe(): Promise<ScreenOffProbeResult> {
  return guard(() => requireNative().cancelScreenOffProbe());
}

export * from './errors';
export * from './types';
export { widgetActionConstants, widgetPrefsKeys, WIDGET_PREFS_FILE } from './widgetContract';

/** The real client, shaped so tests can substitute a fake. */
export const nativeScreenTimeout: StilltimeClient = {
  isNativeAvailable,
  getPermissionState,
  requestWritePermission,
  openWriteSettings,
  openBatterySettings,
  getTimeoutSnapshot,
  applyTimeout,
  getPowerState,
  getStayAwakeState,
  startStayAwake,
  stopStayAwake,
  reconcileStayAwake,
  notifyWidgets,
  startScreenOffProbe,
  getScreenOffProbe,
  cancelScreenOffProbe,
};