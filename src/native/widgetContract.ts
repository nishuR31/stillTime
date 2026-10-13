/**
 * Single source of truth for the widget's shared contract.
 *
 * The Kotlin widget runs in the app process but may execute while the React
 * Native runtime is dead, so it cannot call into JS. Both sides instead agree
 * on the values below and communicate through
 *
 *   - `SharedPreferences` file `stilltime_widget_prefs`
 *   - explicit broadcasts carrying an int `timeout_ms` extra
 *
 * These names MUST match `modules/screen-timeout/android/src/main/java/
 * com/stilltime/timeout/StilltimeWidgetContract.kt`, which is the authoritative
 * implementation. `plugins/withStilltimeAndroid.ts` mirrors the shared subset.
 */

export const WIDGET_PREFS_FILE = 'stilltime_widget_prefs';
export const WIDGET_PACKAGE_SUFFIX = 'widget';

export const widgetPrefsKeys = {
  /** What Stilltime most recently applied and verified (ms). */
  appliedTimeoutMs: 'applied_timeout_ms',
  /** Live value observed from Settings.System (ms). Authoritative. */
  observedTimeoutMs: 'observed_timeout_ms',
  /** Epoch ms when the observed value was last refreshed. */
  observedAt: 'observed_at',
  /** 1 when the WRITE_SETTINGS grant is present. */
  canWrite: 'can_write',
  /** 1 while a Stay Awake session is running. */
  stayAwakeActive: 'stay_awake_active',
  /** Epoch ms when Stay Awake started; 0 when inactive. */
  stayAwakeStartedAt: 'stay_awake_started_at',
  /** Timeout the device had before the Stay Awake session. */
  stayAwakeOriginalMs: 'stay_awake_original_ms',
  /** What Stay Awake applied. */
  stayAwakeAppliedMs: 'stay_awake_applied_ms',
} as const;

export const widgetActionConstants = {
  /** Widget -> provider: write this timeout. Carries `extraTimeoutMs`. */
  actionApply: 'com.stilltime.app.widget.action.APPLY_TIMEOUT',
  /** Widget -> provider: toggle Stay Awake. */
  actionToggleStayAwake: 'com.stilltime.app.widget.action.TOGGLE_STAY_AWAKE',
  /** Widget -> provider: redraw. */
  actionRefresh: 'com.stilltime.app.widget.action.REFRESH',
  /** App -> widget: redraw after the app changed something. */
  appRefreshAction: 'com.stilltime.app.action.WIDGET_REFRESH',
  extraTimeoutMs: 'timeout_ms',
} as const;

/** Bounds mirrored from the Kotlin contract and `src/domain/timeouts.ts`. */
export const WIDGET_MIN_TIMEOUT_MS = 15_000;
export const WIDGET_MAX_TIMEOUT_MS = 3_600_000;
export const WIDGET_STAY_AWAKE_TIMEOUT_MS = 1_800_000;

/** The four quick values the widget offers. Mirrored in Kotlin. */
export const WIDGET_PRESET_MS = [30_000, 60_000, 300_000, 900_000] as const;

export const widgetComponent = {
  className: 'StilltimeWidgetProvider',
  configurationActivityClassName: 'StilltimeWidgetConfigureActivity',
  layoutName: 'widget_stilltime',
  infoXmlName: 'timeout_widget_info',
} as const;