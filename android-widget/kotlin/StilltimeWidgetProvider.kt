package __STILLTIME_APP_PACKAGE__.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import __STILLTIME_APP_PACKAGE__.R
import com.stilltime.timeout.StayAwakeStore
import com.stilltime.timeout.StilltimeWidgetContract
import com.stilltime.timeout.TimeoutEngine

/**
 * Stilltime's home-screen widget.
 *
 * `__STILLTIME_APP_PACKAGE__` is rewritten by `plugins/withStilltimeAndroid.ts`
 * to the real application id, so this file is a tracked source rather than a
 * generated one.
 *
 * Design constraints:
 *   - Works with the React Native process dead. It never calls into JS.
 *   - Writes go through the same verified [TimeoutEngine] the app uses, so a
 *     widget tap cannot produce an unverified state.
 *   - Every tap validates its input before touching a system setting.
 *   - All PendingIntents are immutable: none of them needs data from an
 *     untrusted source.
 */
class StilltimeWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (widgetId in appWidgetIds) {
            render(context, appWidgetManager, widgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            StilltimeWidgetContract.ACTION_APPLY_TIMEOUT ->
                applyTimeout(context, intent.getIntExtra(StilltimeWidgetContract.EXTRA_TIMEOUT_MS, 0))

            StilltimeWidgetContract.ACTION_TOGGLE_STAY_AWAKE -> toggleStayAwake(context)

            StilltimeWidgetContract.ACTION_REFRESH,
            StilltimeWidgetContract.ACTION_APP_REFRESH,
            AppWidgetManager.ACTION_APPWIDGET_UPDATE,
            AppWidgetManager.ACTION_APPWIDGET_DELETED,
            -> refreshAll(context)
        }
    }

    // -----------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------

    private fun applyTimeout(context: Context, requestedMs: Int) {
        val engine = TimeoutEngine(context)

        // Validate before touching anything: an out-of-range extra must never
        // reach Settings.System, even if a future caller is buggy.
        if (!StilltimeWidgetContract.isInRange(requestedMs)) {
            Log.w(TAG, "Rejected out-of-range widget value: ${requestedMs}ms")
            refreshAll(context)
            return
        }

        if (!engine.canWrite()) {
            Log.w(TAG, "Widget tapped without the WRITE_SETTINGS grant.")
            StilltimePrefs.record(context, engine.observedTimeoutMs(), canWrite = false)
            refreshAll(context)
            return
        }

        val applied = engine.tryWriteTimeoutMs(requestedMs)

        // On failure keep the previously applied value rather than showing a
        // number the device is not actually using.
        StilltimePrefs.record(
            context,
            applied ?: engine.observedTimeoutMs(),
            canWrite = true,
        )
        refreshAll(context)
    }

    private fun toggleStayAwake(context: Context) {
        val engine = TimeoutEngine(context)
        val store = StayAwakeStore(context)

        if (!engine.canWrite()) {
            refreshAll(context)
            return
        }

        val observed = engine.observedTimeoutMs()
        val session = store.reconcile(observed)

        if (session.active) {
            val original = session.originalMs
            if (session.drifted || original == null) {
                // The timeout was changed outside Stilltime. Do not clobber it.
                store.clearSession()
            } else {
                engine.tryWriteTimeoutMs(original)
                store.clearSession()
            }
        } else {
            val applied = engine.tryWriteTimeoutMs(StilltimeWidgetContract.STAY_AWAKE_TIMEOUT_MS)
            if (applied != null) {
                store.startSession(observed, applied, System.currentTimeMillis())
            }
        }

        refreshAll(context)
    }

    private fun refreshAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = try {
            manager.getAppWidgetIds(ComponentName(context, StilltimeWidgetProvider::class.java))
        } catch (error: Exception) {
            Log.w(TAG, "Could not enumerate widgets: ${error.message}")
            return
        }
        for (widgetId in ids) {
            render(context, manager, widgetId)
        }
    }

    // -----------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------

    private fun render(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val engine = TimeoutEngine(context)
        val observed = engine.observedTimeoutMs()
        val session = StayAwakeStore(context).reconcile(observed)

        StilltimePrefs.record(context, observed, canWrite = engine.canWrite())

        val views = RemoteViews(context.packageName, R.layout.widget_stilltime).apply {
            setTextViewText(R.id.widget_value, WidgetText.format(observed))
            setTextViewText(
                R.id.widget_status,
                when {
                    !engine.canWrite() -> context.getString(R.string.widget_status_no_permission)
                    session.drifted -> context.getString(R.string.widget_status_changed)
                    session.active -> context.getString(R.string.widget_status_stay_awake)
                    else -> context.getString(R.string.widget_status_ready)
                },
            )
            setViewVisibility(
                R.id.widget_stay_awake,
                if (session.active) View.VISIBLE else View.GONE,
            )

            val presets = StilltimeWidgetContract.WIDGET_PRESETS_MS
            val presetIds = intArrayOf(
                R.id.widget_preset_1,
                R.id.widget_preset_2,
                R.id.widget_preset_3,
                R.id.widget_preset_4,
            )
            presets.forEachIndexed { index, timeoutMs ->
                val viewId = presetIds.getOrNull(index) ?: return@forEachIndexed
                setTextViewText(viewId, WidgetText.format(timeoutMs))
                setContentDescription(
                    viewId,
                    context.getString(R.string.widget_preset_description, WidgetText.describe(timeoutMs)),
                )
                setOnClickPendingIntent(viewId, presetIntent(context, widgetId, timeoutMs))
            }
            setOnClickPendingIntent(R.id.widget_stay_awake, toggleIntent(context, widgetId))
            setOnClickPendingIntent(R.id.widget_open, openAppIntent(context, widgetId))
        }

        try {
            manager.updateAppWidget(widgetId, views)
        } catch (error: Exception) {
            Log.w(TAG, "Could not update widget $widgetId: ${error.message}")
        }
    }

    // -----------------------------------------------------------------
    // PendingIntents
    // -----------------------------------------------------------------

    private fun presetIntent(context: Context, widgetId: Int, timeoutMs: Int): PendingIntent {
        val intent = Intent(context, StilltimeWidgetProvider::class.java).apply {
            action = StilltimeWidgetContract.ACTION_APPLY_TIMEOUT
            putExtra(StilltimeWidgetContract.EXTRA_TIMEOUT_MS, timeoutMs)
        }
        return PendingIntent.getBroadcast(
            context,
            requestCode(widgetId, REQUEST_PRESET),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun toggleIntent(context: Context, widgetId: Int): PendingIntent {
        val intent = Intent(context, StilltimeWidgetProvider::class.java).apply {
            action = StilltimeWidgetContract.ACTION_TOGGLE_STAY_AWAKE
        }
        return PendingIntent.getBroadcast(
            context,
            requestCode(widgetId, REQUEST_TOGGLE),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun openAppIntent(context: Context, widgetId: Int): PendingIntent {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: return toggleIntent(context, widgetId)
        return PendingIntent.getActivity(
            context,
            requestCode(widgetId, REQUEST_OPEN),
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /**
     * PendingIntents are matched by request code, not by intent contents, so the
     * widget id is mixed in to keep separately placed widgets independent.
     */
    private fun requestCode(widgetId: Int, base: Int): Int = base * 1_000 + widgetId

    companion object {
        private const val TAG = "StilltimeWidget"
        private const val REQUEST_PRESET = 1_000_000
        private const val REQUEST_TOGGLE = 2_000_000
        private const val REQUEST_OPEN = 3_000_000
    }
}