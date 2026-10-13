/**
 * Interprets the device's public power state into guidance.
 *
 * Rules we hold ourselves to:
 *   - No unsupported claims. Android does not tell us *why* a write failed, so
 *     we never say "Battery Saver did this". We say what we observed and what
 *     the user can do.
 *   - We never request `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` by
 *     default. Exemption requests are opt-in and live behind an explicit
 *     affordance in Settings.
 *   - Battery Saver does not block `Settings.System.putInt` on most devices,
 *     so we treat it as a *diagnostic* signal, not a hard gate.
 */

export interface PowerSnapshot {
  /** `PowerManager.isPowerSaveMode`. */
  powerSaveMode: boolean;
  /** `PowerManager.isDeviceIdleMode` (API 23+). */
  deviceIdleMode: boolean;
  /** `PowerManager.isIgnoringBatteryOptimizations` (API 23+). */
  ignoringBatteryOptimizations: boolean;
  /** Android SDK int reported by the native module. */
  sdkInt: number;
  /** Manufacturer, e.g. "Xiaomi". */
  manufacturer: string;
}

export type PowerImpact = 'none' | 'noticeable' | 'blocked';

export interface PowerGuidance {
  impact: PowerImpact;
  title: string;
  detail: string;
  /** True when the UI should offer a link into Android's battery settings. */
  suggestBatterySettings: boolean;
}

export function summarisePower(snapshot: PowerSnapshot): PowerGuidance {
  const { powerSaveMode, deviceIdleMode, ignoringBatteryOptimizations } = snapshot;

  if (deviceIdleMode) {
    return {
      impact: 'blocked',
      title: 'Device is idle',
      detail:
        'Android has put the device into Doze. Writes may be deferred or ignored until the device wakes. Move it and use it for a few seconds, then try again.',
      suggestBatterySettings: true,
    };
  }

  if (powerSaveMode && !ignoringBatteryOptimizations) {
    return {
      impact: 'noticeable',
      title: 'Battery Saver is on',
      detail:
        'Screen-off timeouts are usually still settable in Battery Saver, but some manufacturers defer them. If the value does not stick, allow Stilltime to run unrestricted in Android battery settings.',
      suggestBatterySettings: true,
    };
  }

  if (powerSaveMode) {
    return {
      impact: 'noticeable',
      title: 'Battery Saver is on',
      detail: 'Stilltime is exempt from battery optimisation, so writes should apply normally.',
      suggestBatterySettings: false,
    };
  }

  return {
    impact: 'none',
    title: 'Power settings look normal',
    detail: 'No power-saving mode is restricting system settings right now.',
    suggestBatterySettings: false,
  };
}

const MANUFACTURER_HINTS: readonly { match: RegExp; note: string }[] = [
  {
    match: /xiaomi|redmi|poco/i,
    note: 'MIUI/HyperOS adds its own auto-brightness and screen-off rules that can override the system timeout.',
  },
  {
    match: /samsung/i,
    note: 'Samsung One UI may apply "adapt screen timeout" learning that adjusts the value later.',
  },
  {
    match: /huawei|honor/i,
    note: 'EMUI/HarmonyOS manages screen timeout through its own screen-on settings.',
  },
  {
    match: /oppo|realme|oneplus/i,
    note: 'ColorOS/OxygenOS applies extra battery protections on top of the system timeout.',
  },
  {
    match: /vivo/i,
    note: 'FuntouchOS adds background power management that can interact with the screen timeout.',
  },
];

export function manufacturerNote(manufacturer: string): string | null {
  const hint = MANUFACTURER_HINTS.find((candidate) => candidate.match.test(manufacturer));
  return hint?.note ?? null;
}