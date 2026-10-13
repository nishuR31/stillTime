package __STILLTIME_APP_PACKAGE__.widget

import android.content.Context
import com.stilltime.timeout.StilltimeWidgetContract

/**
 * Writes the last-known good state into the shared `SharedPreferences` file so
 * both the app and the widget agree without any IPC.
 *
 * The app writes through its own module; this is the widget's write path and
 * both use the same keys from `StilltimeWidgetContract`.
 */
internal object StilltimePrefs {

    fun record(context: Context, timeoutMs: Int, canWrite: Boolean) {
        val prefs = context.applicationContext.getSharedPreferences(
            StilltimeWidgetContract.PREFS_FILE,
            Context.MODE_PRIVATE,
        )
        prefs.edit()
            .putInt(StilltimeWidgetContract.KEY_OBSERVED_TIMEOUT_MS, timeoutMs)
            .putInt(StilltimeWidgetContract.KEY_APPLIED_TIMEOUT_MS, timeoutMs)
            .putLong(StilltimeWidgetContract.KEY_OBSERVED_AT, System.currentTimeMillis())
            .putBoolean(StilltimeWidgetContract.KEY_CAN_WRITE, canWrite)
            .apply()
    }

    fun lastKnownMs(context: Context): Int {
        val prefs = context.applicationContext.getSharedPreferences(
            StilltimeWidgetContract.PREFS_FILE,
            Context.MODE_PRIVATE,
        )
        return prefs.getInt(StilltimeWidgetContract.KEY_OBSERVED_TIMEOUT_MS, 0)
    }

    fun lastKnownAt(context: Context): Long {
        val prefs = context.applicationContext.getSharedPreferences(
            StilltimeWidgetContract.PREFS_FILE,
            Context.MODE_PRIVATE,
        )
        return prefs.getLong(StilltimeWidgetContract.KEY_OBSERVED_AT, 0L)
    }
}