package __STILLTIME_APP_PACKAGE__.widget

/**
 * Duration formatting for `RemoteViews`.
 *
 * Deliberately has no Android dependency so it is cheap, deterministic, and
 * mirrors `formatDuration` in `src/domain/timeouts.ts` exactly.
 */
internal object WidgetText {

    fun format(timeoutMs: Int): String {
        if (timeoutMs <= 0) return "—"

        val seconds = timeoutMs / 1000
        return when {
            seconds < 60 -> "${seconds}s"
            seconds < 3600 -> {
                val minutes = seconds / 60
                val remainder = seconds % 60
                if (remainder == 0) "${minutes}m" else "${minutes}m ${remainder}s"
            }
            else -> {
                val hours = seconds / 3600
                val minutes = (seconds % 3600) / 60
                if (minutes == 0) "${hours}h" else "${hours}h ${minutes}m"
            }
        }
    }

    /** Content description for the value row, since "5m" reads poorly aloud. */
    fun describe(timeoutMs: Int): String {
        if (timeoutMs <= 0) return "Screen timeout unknown"
        val seconds = timeoutMs / 1000
        return when {
            seconds < 60 -> "$seconds seconds"
            seconds < 3600 -> {
                val minutes = seconds / 60
                "$minutes ${if (minutes == 1) "minute" else "minutes"}"
            }
            else -> {
                val hours = seconds / 3600
                "$hours ${if (hours == 1) "hour" else "hours"}"
            }
        }
    }
}