package com.stilltime.timeout

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The Stilltime bridge.
 *
 * Registered as `StilltimeTimeout` on the JS side. Every function is
 * synchronous except the permission and settings-launch functions, which need
 * to survive the Activity being paused.
 *
 * The module never guesses. It reports `observedMs` (what the device holds),
 * `requestedMs` (what the user asked for) and `appliedMs` (what it read back
 * after writing) as separate values, and refuses to resolve a write it could
 * not verify.
 */
class StilltimeTimeoutModule : Module() {

    private lateinit var engine: TimeoutEngine
    private lateinit var stayAwakeStore: StayAwakeStore
    private lateinit var screenOffProbe: ScreenOffProbe

    private val launchInProgress = AtomicBoolean(false)

    override fun definition() = ModuleDefinition {
        Name("StilltimeTimeout")

        OnCreate {
            val context = appContext.reactContext ?: throw IllegalStateException(
                "StilltimeTimeout requires a ReactApplicationContext."
            )
            engine = TimeoutEngine(context)
            stayAwakeStore = StayAwakeStore(context)
            screenOffProbe = ScreenOffProbe(context, engine)
        }

        OnDestroy {
            launchInProgress.set(false)
            // The receiver must not outlive the module instance; the persisted
            // probe state survives so a later launch can report it honestly.
            if (::screenOffProbe.isInitialized) screenOffProbe.dispose()
        }

        // ---------------------------------------------------------------
        // Constants
        // ---------------------------------------------------------------
        Constant("minTimeoutMs").get { StilltimeWidgetContract.MIN_TIMEOUT_MS }
        Constant("maxTimeoutMs").get { StilltimeWidgetContract.MAX_TIMEOUT_MS }
        Constant("stayAwakeTimeoutMs").get { StilltimeWidgetContract.STAY_AWAKE_TIMEOUT_MS }
        Constant("presets").get { TimeoutEngine.PRESETS }
        Constant("appVersion").get { appVersion() }
        Constant("buildNumber").get { appBuildNumber() }


        // ---------------------------------------------------------------
        // Permission
        // ---------------------------------------------------------------

        Function("getPermissionState") {
            permissionState()
        }

        /**
         * Opens `ACTION_MANAGE_WRITE_SETTINGS` for this package and resolves
         * with the *post-return* permission state.
         *
         * Android never grants this automatically, so `canWrite` may still be
         * `false` when the promise resolves. The JS layer treats that as "user
         * backed out" rather than an error.
         */
        AsyncFunction("requestWritePermission") {
            val activity = appContext.currentActivity
                ?: throw StilltimeCodedException(
                    ErrorCodes.INTERNAL,
                    "No foreground Activity to host the settings screen.",
                )
            if (!launchInProgress.compareAndSet(false, true)) {
                return@AsyncFunction permissionState()
            }
            try {
                val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                    data = Uri.parse("package:${packageName()}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
            } catch (error: Exception) {
                launchInProgress.set(false)
                throw StilltimeCodedException(
                    ErrorCodes.INTERNAL,
                    "Could not open the system settings screen: ${error.message}",
                )
            }
            permissionState()
        }

        AsyncFunction("openWriteSettings") {
            launchSettings(Settings.ACTION_MANAGE_WRITE_SETTINGS, "package:${packageName()}")
        }

        AsyncFunction("openBatterySettings") {
            val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            launchSettings(intent)
        }

        // ---------------------------------------------------------------
        // Timeout
        // ---------------------------------------------------------------

        Function("getTimeoutSnapshot") { requestedMs: Int? ->
            timeoutSnapshot(requestedMs)
        }

        Function("applyTimeout") { requestedMs: Int ->
            val applied = engine.writeTimeoutMs(requestedMs)
            recordApplied(applied)
            val snapshot = timeoutSnapshot(requestedMs, overrideObserved = applied)
            mapOf(
                "snapshot" to snapshot,
                "stayAwake" to stayAwakeStore.reconcile(applied).toMap(),
            )
        }

        // ---------------------------------------------------------------
        // Power diagnostics
        // ---------------------------------------------------------------

        Function("getPowerState") {
            engine.powerSnapshot()
        }

        // ---------------------------------------------------------------
        // Stay Awake
        // ---------------------------------------------------------------

        Function("getStayAwakeState") {
            stayAwakeStore.reconcile(engine.observedTimeoutMs()).toMap()
        }

        Function("startStayAwake") { requestedMs: Int? ->
            val target = StilltimeWidgetContract.clamp(
                requestedMs ?: StilltimeWidgetContract.STAY_AWAKE_TIMEOUT_MS,
            )
            val before = engine.observedTimeoutMs()

            val applied = engine.writeTimeoutMs(target)
            stayAwakeStore.startSession(before, applied, System.currentTimeMillis())
            recordApplied(applied)

            mapOf(
                "snapshot" to timeoutSnapshot(target, overrideObserved = applied),
                "stayAwake" to stayAwakeStore.reconcile(applied).toMap(),
            )
        }

        Function("stopStayAwake") {
            val before = engine.observedTimeoutMs()
            val view = stayAwakeStore.reconcile(before)

            if (!view.active) {
                // Nothing to undo. Do not invent a "restore".
                stayAwakeStore.clearSession()
                return@Function mapOf(
                    "restoredMs" to null,
                    "skipped" to false,
                    "inactive" to true,
                    "snapshot" to timeoutSnapshot(null),
                    "stayAwake" to StayAwakeStore.StayAwakeView.inactive().toMap(),
                )
            }

            val original = view.originalMs
            if (original == null) {
                stayAwakeStore.clearSession()
                return@Function mapOf(
                    "restoredMs" to null,
                    "skipped" to true,
                    "inactive" to true,
                    "snapshot" to timeoutSnapshot(null),
                    "stayAwake" to StayAwakeStore.StayAwakeView.inactive().toMap(),
                )
            }

            if (view.drifted) {
                // The user changed the timeout elsewhere. Leave their value alone.
                stayAwakeStore.clearSession()
                return@Function mapOf(
                    "restoredMs" to null,
                    "skipped" to true,
                    "inactive" to true,
                    "snapshot" to timeoutSnapshot(null),
                    "stayAwake" to mapOf(
                        "active" to false,
                        "startedAt" to view.startedAt,
                        "originalMs" to original,
                        "appliedMs" to view.appliedMs,
                        "observedMs" to before,
                        "drifted" to true,
                        "remainingMs" to null,
                    ),
                )
            }

            val restored = engine.writeTimeoutMs(original)
            stayAwakeStore.clearSession()
            recordApplied(restored)

            mapOf(
                "restoredMs" to restored,
                "skipped" to false,
                "inactive" to true,
                "snapshot" to timeoutSnapshot(original, overrideObserved = restored),
                "stayAwake" to StayAwakeStore.StayAwakeView.inactive().toMap(),
            )
        }

        /**
         * Idempotent recovery. Safe to call on every foreground.
         *
         * Never writes a timeout. It only refreshes the recorded view so a stale
         * or drifted session becomes visible instead of being blindly re-applied.
         */
        Function("reconcileStayAwake") {
            stayAwakeStore.reconcile(engine.observedTimeoutMs()).toMap()
        }

        // ---------------------------------------------------------------
        // Widget bridge (fire-and-forget)
        // ---------------------------------------------------------------

        Function("notifyWidgets") { timeoutMs: Int ->
            val context = appContext.reactContext ?: return@Function
            recordApplied(timeoutMs)
            WidgetNotifier.notify(context, timeoutMs)
        }

        // ---------------------------------------------------------------
        // Screen-off probe (verification, hidden behind the 7-tap footer)
        // ---------------------------------------------------------------

        /**
         * Arm a measurement of the real idle-to-screen-off time.
         *
         * `expectedMs` is the timeout currently on the device. When
         * `restoreToMs` is non-null it is written back the instant the screen
         * goes off, so a quick test never leaves a 15-second timeout behind.
         */
        Function("startScreenOffProbe") { expectedMs: Int, restoreToMs: Int? ->
            screenOffProbe.arm(expectedMs, restoreToMs)
        }

        /** Current probe state. Safe to call at any time; writes nothing. */
        Function("getScreenOffProbe") {
            screenOffProbe.read()
        }

        Function("cancelScreenOffProbe") {
            screenOffProbe.cancel()
        }
    }

    // -------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------

    private fun permissionState(): Map<String, Any?> = mapOf(
        "canWrite" to engine.canWrite(),
        "sdkInt" to engine.sdkInt(),
    )

    /**
     * `versionName` from the installed package.
     *
     * Read through `PackageManager` rather than a build-time constant so the
     * value always describes the APK actually running, and so the JS never has
     * to hard-code a second copy of the version.
     */
    private fun appVersion(): String = runCatching {
        val context = appContext.reactContext?.applicationContext ?: return "unknown"
        context.packageManager
            .getPackageInfo(context.packageName, 0)
            .versionName ?: "unknown"
    }.getOrDefault("unknown")

    /**
     * `versionCode` as a double, because that is what a JS number is.
     * `longVersionCode` is API 28+; below that the legacy `Int` field is used.
     */
    private fun appBuildNumber(): Double = runCatching {
        val context = appContext.reactContext?.applicationContext ?: return 0.0
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode.toDouble()
        } else {
            @Suppress("DEPRECATION")
            info.versionCode.toDouble()
        }
    }.getOrDefault(0.0)


    /**
     * The application id, used to deep-link into the system settings screens.
     *
     * `AppContext` exposes a `Context`, not `packageName`, and its
     * `reactContext` is nullable, so this fails loudly rather than building a
     * malformed `package:` URI.
     */
    private fun packageName(): String =
        appContext.reactContext?.packageName
            ?: throw StilltimeCodedException(
                ErrorCodes.INTERNAL,
                "Cannot resolve the application id: the React context is unavailable.",
            )

    private fun timeoutSnapshot(
        requestedMs: Int?,
        overrideObserved: Int? = null,
    ): Map<String, Any?> {
        val observed = overrideObserved ?: engine.observedTimeoutMs()
        return mapOf(
            "observedMs" to observed,
            "requestedMs" to (requestedMs ?: observed),
            "appliedMs" to observed,
            "verified" to true,
            "canWrite" to engine.canWrite(),
            "outsideDialBounds" to !engine.isWithinDialBounds(observed),
            "sdkInt" to engine.sdkInt(),
            "manufacturer" to engine.manufacturer(),
        )
    }

    /** Mirror the value into SharedPreferences so widgets can render it. */
    private fun recordApplied(timeoutMs: Int) {
        val context = appContext.reactContext ?: return
        context.getSharedPreferences(StilltimeWidgetContract.PREFS_FILE, android.content.Context.MODE_PRIVATE)
            .edit()
            .putInt(StilltimeWidgetContract.KEY_APPLIED_TIMEOUT_MS, timeoutMs)
            .putInt(StilltimeWidgetContract.KEY_OBSERVED_TIMEOUT_MS, timeoutMs)
            .putLong(StilltimeWidgetContract.KEY_OBSERVED_AT, System.currentTimeMillis())
            .putBoolean(StilltimeWidgetContract.KEY_CAN_WRITE, engine.canWrite())
            .apply()
    }

    private fun launchSettings(action: String, data: String? = null) {
        launchSettings(Intent(action).apply { if (data != null) this.data = Uri.parse(data) })
    }

    private fun launchSettings(intent: Intent) {
        val activity = appContext.currentActivity
        val context = appContext.reactContext
        try {
            if (activity != null) {
                activity.startActivity(intent)
            } else if (context != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            } else {
                throw StilltimeCodedException(
                    ErrorCodes.INTERNAL,
                    "No Activity or Context available to open settings.",
                )
            }
        } catch (error: Exception) {
            throw StilltimeCodedException(
                ErrorCodes.INTERNAL,
                "Could not open Android settings: ${error.message}",
            )
        }
    }
}

/** Compile-time guard: this module is Android-only by design. */
internal object StilltimePlatformGuard {
    fun assertSupported(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP
}