package com.stilltime.timeout

import android.content.ContentResolver
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

/**
 * The whole of Stilltime's system access lives here.
 *
 * Kept deliberately narrow:
 *   - read `Settings.System.SCREEN_OFF_TIMEOUT`
 *   - check the "Modify system settings" grant
 *   - write the timeout and read it back to prove it stuck
 *
 * Everything is synchronous and public-API only. No hidden APIs, no shell, no
 * root, no `Runtime.exec`.
 *
 * Public (not `internal`) because the home-screen widget — which the config
 * plugin copies into the app module — reuses the same verified write path.
 */
class TimeoutEngine(context: Context) {

    private val appContext: Context = context.applicationContext
    private val resolver: ContentResolver get() = appContext.contentResolver

    val minTimeoutMs: Int = StilltimeWidgetContract.MIN_TIMEOUT_MS
    val maxTimeoutMs: Int = StilltimeWidgetContract.MAX_TIMEOUT_MS

    /** Mirrors `Settings.System.canWrite`. */
    fun canWrite(): Boolean = Settings.System.canWrite(appContext)

    /**
     * The live timeout in milliseconds.
     *
     * Android's documented default is used when the setting has never been
     * written, which keeps the first frame meaningful on a fresh device.
     */
    fun observedTimeoutMs(): Int = Settings.System.getInt(
        resolver,
        Settings.System.SCREEN_OFF_TIMEOUT,
        DEFAULT_TIMEOUT_MS,
    )

    /**
     * Writes [timeoutMs] and verifies it by reading it back.
     *
     * @throws StilltimeCodedException with `E_OUT_OF_RANGE`,
     *   `E_PERMISSION_REQUIRED`, `E_WRITE_FAILED` or `E_VERIFY_FAILED`.
     */
    fun writeTimeoutMs(timeoutMs: Int): Int {
        if (!StilltimeWidgetContract.isInRange(timeoutMs)) {
            throw StilltimeCodedException(
                ErrorCodes.OUT_OF_RANGE,
                "Timeout ${timeoutMs}ms is outside " +
                    "${StilltimeWidgetContract.MIN_TIMEOUT_MS}..${StilltimeWidgetContract.MAX_TIMEOUT_MS}ms.",
            )
        }
        if (!canWrite()) {
            throw StilltimeCodedException(
                ErrorCodes.PERMISSION_REQUIRED,
                "Stilltime does not have the \"Modify system settings\" grant.",
            )
        }

        val wrote = Settings.System.putInt(
            resolver,
            Settings.System.SCREEN_OFF_TIMEOUT,
            timeoutMs,
        )

        if (!wrote) {
            throw StilltimeCodedException(
                ErrorCodes.WRITE_FAILED,
                "Settings.System.putInt returned false for SCREEN_OFF_TIMEOUT.",
            )
        }

        // Verify. `putInt` returning true does not guarantee the value stuck:
        // OEM policy, battery managers and app-ops can silently discard it.
        val readBack = observedTimeoutMs()
        if (readBack != timeoutMs) {
            throw StilltimeCodedException(
                ErrorCodes.VERIFY_FAILED,
                "Wrote ${timeoutMs}ms but the device reports ${readBack}ms. " +
                    "A battery manager or manufacturer policy likely deferred the change.",
            )
        }
        return readBack
    }

    /** Best-effort write for widget paths, where a failure is not fatal. */
    fun tryWriteTimeoutMs(timeoutMs: Int): Int? = try {
        writeTimeoutMs(timeoutMs)
    } catch (_: Exception) {
        null
    }

    fun isWithinDialBounds(timeoutMs: Int): Boolean =
        StilltimeWidgetContract.isInRange(timeoutMs)

    fun sdkInt(): Int = Build.VERSION.SDK_INT

    fun manufacturer(): String = Build.MANUFACTURER ?: ""

    /**
     * Snapshot of the public power signals we are allowed to rely on.
     *
     * `isPowerSaveMode` is public since API 21; Doze and battery-optimisation
     * queries are API 23+. Below that they are reported as `false`, never guessed.
     */
    fun powerSnapshot(): Map<String, Any?> {
        val powerManager = appContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val powerSaveMode = powerManager?.isPowerSaveMode ?: false

        var deviceIdleMode = false
        var ignoringBatteryOptimisations = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            deviceIdleMode = powerManager?.isDeviceIdleMode ?: false
            ignoringBatteryOptimisations = readIgnoringBatteryOptimisations(powerManager)
        }

        return mapOf(
            "powerSaveMode" to powerSaveMode,
            "deviceIdleMode" to deviceIdleMode,
            "ignoringBatteryOptimizations" to ignoringBatteryOptimisations,
            "sdkInt" to sdkInt(),
            "manufacturer" to manufacturer(),
        )
    }

    private fun readIgnoringBatteryOptimisations(powerManager: PowerManager?): Boolean {
        val manager = powerManager ?: return false
        return try {
            manager.isIgnoringBatteryOptimizations(appContext.packageName)
        } catch (_: SecurityException) {
            // Reading the flag needs no permission on most builds; treat a
            // SecurityException as "unknown -> false" rather than crashing.
            false
        }
    }

    companion object {
        /** Android's documented default when the setting has never been written. */
        const val DEFAULT_TIMEOUT_MS: Int = 1_800_000

        /** Mirrors `TIMEOUT_PRESETS` in `src/domain/timeouts.ts`. */
        val PRESETS: List<Map<String, Any>> = listOf(
            mapOf("id" to "p15s", "label" to "15s", "ms" to 15_000),
            mapOf("id" to "p30s", "label" to "30s", "ms" to 30_000),
            mapOf("id" to "p1m", "label" to "1m", "ms" to 60_000),
            mapOf("id" to "p2m", "label" to "2m", "ms" to 120_000),
            mapOf("id" to "p5m", "label" to "5m", "ms" to 300_000),
            mapOf("id" to "p10m", "label" to "10m", "ms" to 600_000),
            mapOf("id" to "p15m", "label" to "15m", "ms" to 900_000),
            mapOf("id" to "p30m", "label" to "30m", "ms" to 1_800_000),
        )
    }
}