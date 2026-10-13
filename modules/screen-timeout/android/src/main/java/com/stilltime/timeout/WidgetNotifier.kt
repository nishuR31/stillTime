package com.stilltime.timeout

import android.content.Context
import android.content.Intent

/**
 * Tells every placed widget to redraw after the app changes the timeout.
 *
 * Uses an explicit broadcast so this works whether or not the widget is
 * currently instantiated, and so it keeps working when the React Native process
 * has been killed and restarted. Deliberately swallows failures: a widget that
 * cannot be updated must never turn into an app-level error.
 */
internal object WidgetNotifier {

    fun notify(context: Context, timeoutMs: Int) {
        try {
            val intent = Intent(StilltimeWidgetContract.ACTION_APP_REFRESH).apply {
                setPackage(context.packageName)
                putExtra(StilltimeWidgetContract.EXTRA_TIMEOUT_MS, timeoutMs)
            }
            context.sendBroadcast(intent)
        } catch (_: Exception) {
            // Intentionally ignored.
        }
    }
}