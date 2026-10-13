package com.stilltime.timeout

/**
 * The contract shared between the Expo module and the home-screen widget.
 *
 * This object MUST stay byte-compatible with `src/native/widgetContract.ts`.
 * It lives in the Expo module (a Gradle *library*) rather than beside the
 * widget (which the config plugin copies into the app module) because library
 * code cannot depend on the app module, but app code can depend on the library.
 * For the same reason it is `public`, not `internal`.
 *
 * Communication happens through one `SharedPreferences` file and a handful of
 * explicit broadcasts. There is no IPC and no JS dependency, so the widget keeps
 * working when the React Native process has been killed.
 */
object StilltimeWidgetContract {

    /** SharedPreferences file name. Mirrored in `widgetContract.ts`. */
    const val PREFS_FILE: String = "stilltime_widget_prefs"

    // --- Keys -------------------------------------------------------------
    const val KEY_APPLIED_TIMEOUT_MS: String = "applied_timeout_ms"
    const val KEY_OBSERVED_TIMEOUT_MS: String = "observed_timeout_ms"
    const val KEY_OBSERVED_AT: String = "observed_at"
    const val KEY_CAN_WRITE: String = "can_write"
    const val KEY_SESSION_ACTIVE: String = "stay_awake_active"
    const val KEY_SESSION_STARTED_AT: String = "stay_awake_started_at"
    const val KEY_SESSION_ORIGINAL_MS: String = "stay_awake_original_ms"
    const val KEY_SESSION_APPLIED_MS: String = "stay_awake_applied_ms"

    // --- Broadcast actions ------------------------------------------------
    const val ACTION_APPLY_TIMEOUT: String = "com.stilltime.app.widget.action.APPLY_TIMEOUT"
    const val ACTION_TOGGLE_STAY_AWAKE: String = "com.stilltime.app.widget.action.TOGGLE_STAY_AWAKE"
    const val ACTION_REFRESH: String = "com.stilltime.app.widget.action.REFRESH"
    const val ACTION_APP_REFRESH: String = "com.stilltime.app.action.WIDGET_REFRESH"

    const val EXTRA_TIMEOUT_MS: String = "timeout_ms"

    // --- Bounds (mirror `src/domain/timeouts.ts`) --------------------------
    const val MIN_TIMEOUT_MS: Int = 15_000
    const val MAX_TIMEOUT_MS: Int = 3_600_000

    /** Documented ceiling for a Stay Awake session: 30 minutes. */
    const val STAY_AWAKE_TIMEOUT_MS: Int = 1_800_000

    /** Quick values the widget offers, in ms. */
    val WIDGET_PRESETS_MS: IntArray = intArrayOf(30_000, 60_000, 300_000, 900_000)

    fun clamp(timeoutMs: Int): Int = timeoutMs.coerceIn(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)

    fun isInRange(timeoutMs: Int): Boolean = timeoutMs in MIN_TIMEOUT_MS..MAX_TIMEOUT_MS

    /** Nearest widget preset, used when a widget value cannot be trusted. */
    fun nearestPreset(timeoutMs: Int): Int {
        var best = WIDGET_PRESETS_MS[0]
        var bestDistance = Int.MAX_VALUE
        for (preset in WIDGET_PRESETS_MS) {
            val distance = kotlin.math.abs(preset - timeoutMs)
            if (distance < bestDistance) {
                bestDistance = distance
                best = preset
            }
        }
        return best
    }
}