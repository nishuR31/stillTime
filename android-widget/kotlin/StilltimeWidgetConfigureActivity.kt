package __STILLTIME_APP_PACKAGE__.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import __STILLTIME_APP_PACKAGE__.R

/**
 * Configuration activity required because `timeout_widget_info.xml` sets
 * `android:configure`. Android launches this the first time a widget is placed
 * so the provider can validate the request id.
 *
 * It is intentionally immediate: the widget has no per-instance options, so the
 * activity just confirms the widget id and returns `RESULT_OK`.
 */
class StilltimeWidgetConfigureActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Cancelled unless we were launched with a valid widget id.
        setResult(RESULT_CANCELED)

        val widgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID,
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        setResult(
            RESULT_OK,
            Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId),
        )

        // Draw once so the widget is never blank between placement and the
        // provider's own onUpdate.
        AppWidgetManager.getInstance(this).updateAppWidget(
            widgetId,
            android.widget.RemoteViews(packageName, R.layout.widget_stilltime),
        )

        finish()
    }
}