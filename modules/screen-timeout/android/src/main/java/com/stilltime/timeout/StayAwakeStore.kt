package com.stilltime.timeout

import android.content.Context
import android.content.SharedPreferences

/**
 * Durable Stay Awake session state.
 *
 * This lives in `SharedPreferences`, not in the Expo module instance, because:
 *   - the widget may run while the React Native process has been killed, and
 *   - a module instance can be torn down and recreated between Activity restarts.
 *
 * The rules encoded here are the Kotlin mirror of `src/domain/stayAwake.ts`:
 *   - a session remembers `originalMs` so it can be undone
 *   - restoring is refused when the live timeout no longer matches `appliedMs`
 *   - nothing here ever writes a timeout by itself
 */
class StayAwakeStore(context: Context) {

    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences(
        StilltimeWidgetContract.PREFS_FILE,
        Context.MODE_PRIVATE,
    )

    fun startSession(originalMs: Int, appliedMs: Int, now: Long) {
        prefs.edit()
            .putLong(StilltimeWidgetContract.KEY_SESSION_STARTED_AT, now)
            .putInt(StilltimeWidgetContract.KEY_SESSION_ORIGINAL_MS, originalMs)
            .putInt(StilltimeWidgetContract.KEY_SESSION_APPLIED_MS, appliedMs)
            .putBoolean(StilltimeWidgetContract.KEY_SESSION_ACTIVE, true)
            .apply()
    }

    fun clearSession() {
        prefs.edit()
            .putBoolean(StilltimeWidgetContract.KEY_SESSION_ACTIVE, false)
            .putLong(StilltimeWidgetContract.KEY_SESSION_STARTED_AT, 0L)
            .putInt(StilltimeWidgetContract.KEY_SESSION_ORIGINAL_MS, 0)
            .putInt(StilltimeWidgetContract.KEY_SESSION_APPLIED_MS, 0)
            .apply()
    }

    fun isActive(): Boolean = prefs.getBoolean(StilltimeWidgetContract.KEY_SESSION_ACTIVE, false)

    /**
     * Reconciles the recorded session against what the device currently holds.
     *
     * Never writes. Returns the current view so callers can surface a drift
     * warning instead of silently re-applying a stale value.
     */
    fun reconcile(observedMs: Int): StayAwakeView {
        if (!isActive()) return StayAwakeView.inactive()

        val applied = appliedMs().takeIf { it > 0 } ?: return StayAwakeView.inactive()
        return StayAwakeView(
            active = true,
            startedAt = startedAt().takeIf { it > 0L },
            originalMs = originalMs().takeIf { it > 0 },
            appliedMs = applied,
            observedMs = observedMs,
            drifted = observedMs != applied,
            remainingMs = applied.toLong(),
        )
    }

    /** Start of the session, or null when inactive. */
    fun startedAt(): Long = prefs.getLong(StilltimeWidgetContract.KEY_SESSION_STARTED_AT, 0L)

    /** The value to restore when a session ends, or 0 when unknown. */
    fun originalMs(): Int = prefs.getInt(StilltimeWidgetContract.KEY_SESSION_ORIGINAL_MS, 0)

    /** What we last wrote and verified, or 0 when unknown. */
    fun appliedMs(): Int = prefs.getInt(StilltimeWidgetContract.KEY_SESSION_APPLIED_MS, 0)

    data class StayAwakeView(
        val active: Boolean,
        val startedAt: Long? = null,
        val originalMs: Int? = null,
        val appliedMs: Int? = null,
        val observedMs: Int? = null,
        val drifted: Boolean = false,
        val remainingMs: Long? = null,
    ) {
        fun toMap(): Map<String, Any?> = mapOf(
            "active" to active,
            "startedAt" to startedAt,
            "originalMs" to originalMs,
            "appliedMs" to appliedMs,
            "observedMs" to observedMs,
            "drifted" to drifted,
            "remainingMs" to remainingMs,
        )

        companion object {
            fun inactive() = StayAwakeView(active = false)
        }
    }
}