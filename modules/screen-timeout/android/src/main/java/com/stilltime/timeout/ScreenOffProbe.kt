package com.stilltime.timeout

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.os.SystemClock
import android.util.Log

/**
 * Measures the *real* idle-to-screen-off time and compares it against the
 * timeout Stilltime wrote.
 *
 * Android exposes `Settings.System.SCREEN_OFF_TIMEOUT` but never reports what
 * it actually did with the value. A battery manager, an OEM policy or Doze can
 * silently defer or override a write, and `putInt` returning `true` proves
 * nothing. This probe is how Stilltime finds out.
 *
 * How it works:
 *   - `arm()` registers a receiver for the protected system broadcasts
 *     `ACTION_SCREEN_OFF` and `ACTION_SCREEN_ON`.
 *   - Timing uses [SystemClock.elapsedRealtime], which includes deep sleep and
 *     is monotonic, so it stays correct across the suspend that follows the
 *     screen going dark. `System.currentTimeMillis` can jump when the clock is
 *     corrected, so it is recorded only for display.
 *   - The result is written to `SharedPreferences` with `commit()`, not
 *     `apply()`, because the process may be frozen microseconds later.
 *
 * `ACTION_SCREEN_ON` is the honest failure case: Android resets its idle timer
 * on any user input, so a screen-on before a screen-off means the measurement
 * is invalid rather than "early". Reporting that explicitly is more useful than
 * quietly printing a wrong number.
 *
 * State lives in its own preferences file, deliberately *not* the widget's
 * contract file: the widget has no reason to know about probes, and keeping
 * them separate means the widget contract in `StilltimeWidgetContract.kt`,
 * `src/native/widgetContract.ts` and `plugins/widgetTemplate.js` is unchanged.
 *
 * No permission is required to receive these broadcasts. They are protected, so
 * only the system may send them, but every app may listen. That is also why
 * `registerReceiver` is called without a `RECEIVER_EXPORTED` /
 * `RECEIVER_NOT_EXPORTED` flag: Android exempts receivers that listen only for
 * protected system broadcasts from the API 34 flag requirement.
 */
class ScreenOffProbe(
    context: Context,
    private val engine: TimeoutEngine,
) {

    private val appContext: Context = context.applicationContext

    private val prefs: SharedPreferences = appContext.getSharedPreferences(
        PREFS_FILE,
        Context.MODE_PRIVATE,
    )

    private var registered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_OFF -> onScreenOff()
                Intent.ACTION_SCREEN_ON -> onScreenOn()
            }
        }
    }

    // -------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------

    /**
     * Start measuring.
     *
     * @param expectedMs the timeout currently on the device, i.e. the value the
     *   measurement is compared against.
     * @param restoreToMs when non-null, this value is written back as soon as
     *   the screen goes off. Restoring inside `onReceive` rather than later
     *   matters: the device suspends immediately afterwards, so a deferred
     *   restore may never run.
     */
    fun arm(expectedMs: Int, restoreToMs: Int?): Map<String, Any?> {
        unregister()

        prefs.edit()
            .putString(KEY_STATE, STATE_ARMED)
            .putLong(KEY_ARMED_ELAPSED_MS, SystemClock.elapsedRealtime())
            .putLong(KEY_ARMED_WALL_MS, System.currentTimeMillis())
            .putInt(KEY_EXPECTED_MS, expectedMs)
            .putLong(KEY_MEASURED_MS, -1L)
            .putLong(KEY_SCREEN_OFF_WALL_MS, 0L)
            .putLong(KEY_SCREEN_ON_WALL_MS, 0L)
            .putInt(KEY_RESTORE_TO_MS, restoreToMs ?: -1)
            .putBoolean(KEY_RESTORED, false)
            .putString(KEY_NOTE, "")
            .commit()

        register()
        return read()
    }

    /** Stop measuring and discard whatever was half-recorded. */
    fun cancel(): Map<String, Any?> {
        unregister()
        prefs.edit()
            .putString(KEY_STATE, STATE_CANCELLED)
            .putString(KEY_NOTE, "Cancelled before the screen went off.")
            .commit()
        return read()
    }

    /**
     * Current state, plus staleness derived from the elapsed clock.
     *
     * Reading is safe at any time: it never registers anything and never writes
     * a timeout.
     */
    fun read(): Map<String, Any?> {
        val state = prefs.getString(KEY_STATE, STATE_IDLE) ?: STATE_IDLE
        val armedElapsed = prefs.getLong(KEY_ARMED_ELAPSED_MS, 0L)
        val expectedMs = prefs.getInt(KEY_EXPECTED_MS, -1)
        val measured = prefs.getLong(KEY_MEASURED_MS, -1L)
        val restoreTo = prefs.getInt(KEY_RESTORE_TO_MS, -1)

        var resolvedState = state
        var note = prefs.getString(KEY_NOTE, "") ?: ""

        // A probe left armed means the process died before the screen went off.
        // Say so rather than showing an "in progress" spinner forever.
        if (state == STATE_ARMED && armedElapsed > 0L) {
            val elapsed = SystemClock.elapsedRealtime() - armedElapsed
            if (expectedMs > 0 && elapsed > expectedMs.toLong() + STALE_GRACE_MS) {
                resolvedState = STATE_STALE
                note = "The app was closed or killed before the screen went off, " +
                    "so this attempt could not be measured."
            }
        }

        return mapOf(
            "state" to resolvedState,
            "expectedMs" to if (expectedMs > 0) expectedMs else null,
            "measuredMs" to if (measured >= 0L) measured else null,
            "screenOffAtWallMs" to
                prefs.getLong(KEY_SCREEN_OFF_WALL_MS, 0L).takeIf { it > 0L },
            "screenOnAtWallMs" to
                prefs.getLong(KEY_SCREEN_ON_WALL_MS, 0L).takeIf { it > 0L },
            "armedAtWallMs" to
                prefs.getLong(KEY_ARMED_WALL_MS, 0L).takeIf { it > 0L },
            "restoreToMs" to if (restoreTo > 0) restoreTo else null,
            "restored" to prefs.getBoolean(KEY_RESTORED, false),
            "note" to note,
        )
    }

    /** Unregister without touching persisted state. Called when the module dies. */
    fun dispose() {
        unregister()
    }

    // -------------------------------------------------------------------
    // Receiver
    // -------------------------------------------------------------------

    private fun onScreenOff() {
        val armedElapsed = prefs.getLong(KEY_ARMED_ELAPSED_MS, 0L)
        if (armedElapsed <= 0L) return
        if (prefs.getString(KEY_STATE, STATE_IDLE) != STATE_ARMED) return

        val measured = SystemClock.elapsedRealtime() - armedElapsed

        // Restore first-class: the window between this broadcast and the
        // device suspending is short and unpredictable.
        val restoreTo = prefs.getInt(KEY_RESTORE_TO_MS, -1)
        var restored = false
        if (restoreTo > 0) {
            restored = engine.tryWriteTimeoutMs(restoreTo) == restoreTo
        }

        prefs.edit()
            .putString(KEY_STATE, STATE_COMPLETED)
            .putLong(KEY_MEASURED_MS, measured)
            .putLong(KEY_SCREEN_OFF_WALL_MS, System.currentTimeMillis())
            .putBoolean(KEY_RESTORED, restored)
            .putString(
                KEY_NOTE,
                if (restored || restoreTo <= 0) {
                    ""
                } else {
                    "Stilltime restored the previous timeout, but the write-back did not verify."
                },
            )
            .commit()

        unregister()
    }

    private fun onScreenOn() {
        val armedElapsed = prefs.getLong(KEY_ARMED_ELAPSED_MS, 0L)
        if (armedElapsed <= 0L) return
        if (prefs.getString(KEY_STATE, STATE_IDLE) != STATE_ARMED) return

        prefs.edit()
            .putString(KEY_STATE, STATE_INTERRUPTED)
            .putLong(KEY_MEASURED_MS, SystemClock.elapsedRealtime() - armedElapsed)
            .putLong(KEY_SCREEN_ON_WALL_MS, System.currentTimeMillis())
            .putString(
                KEY_NOTE,
                "The screen came back on before the timeout. Android restarts its idle timer on " +
                    "any touch or key press, so this attempt cannot be measured.",
            )
            .commit()

        unregister()
    }

    private fun register() {
        if (registered) return
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
        }
        appContext.registerReceiver(receiver, filter)
        registered = true
    }

    private fun unregister() {
        if (!registered) return
        registered = false
        try {
            appContext.unregisterReceiver(receiver)
        } catch (error: IllegalArgumentException) {
            Log.w(TAG, "Screen-off receiver was already unregistered.", error)
        }
    }

    companion object {
        private const val TAG = "StilltimeProbe"

        /** Separate from the widget contract on purpose. See the class docs. */
        const val PREFS_FILE: String = "stilltime_probe_prefs"

        const val STATE_IDLE: String = "idle"
        const val STATE_ARMED: String = "armed"
        const val STATE_COMPLETED: String = "completed"
        const val STATE_INTERRUPTED: String = "interrupted"
        const val STATE_STALE: String = "stale"
        const val STATE_CANCELLED: String = "cancelled"

        /**
         * Extra time past the expected timeout before an armed probe is called
         * stale. Generous, because OEM skins routinely add their own delay on
         * top of `SCREEN_OFF_TIMEOUT`.
         */
        const val STALE_GRACE_MS: Long = 5 * 60 * 1000L

        private const val KEY_STATE = "state"
        private const val KEY_ARMED_ELAPSED_MS = "armed_elapsed_ms"
        private const val KEY_ARMED_WALL_MS = "armed_wall_ms"
        private const val KEY_EXPECTED_MS = "expected_ms"
        private const val KEY_MEASURED_MS = "measured_ms"
        private const val KEY_SCREEN_OFF_WALL_MS = "screen_off_wall_ms"
        private const val KEY_SCREEN_ON_WALL_MS = "screen_on_wall_ms"
        private const val KEY_RESTORE_TO_MS = "restore_to_ms"
        private const val KEY_RESTORED = "restored"
        private const val KEY_NOTE = "note"
    }
}
