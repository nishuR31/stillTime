# Privacy

Stilltime is offline by design. It has no account, no analytics, no crash
reporting, and no network permission. Everything it knows stays on the device.

This document describes what the app actually declares. The permission lists
below were read from the **merged release manifest**
(`app/build/intermediates/merged_manifest/release/processReleaseMainManifest/`),
not from intent.

## Permissions

### The permissions Stilltime requests

| Permission | Why |
|---|---|
| `android.permission.WRITE_SETTINGS` | `Settings.System.canWrite()` / `putInt()` on `SCREEN_OFF_TIMEOUT` |
| `android.permission.VIBRATE` | `expo-haptics` calls `Vibrator.vibrate()` for dial detents, preset taps and apply/success/warning/error feedback. Android throws `SecurityException` from `Vibrator.vibrate()` without this grant. |

`WRITE_SETTINGS` is an *app-op* permission, not a runtime permission. Android
grants it from `Settings.ACTION_MANAGE_WRITE_SETTINGS`, so the user always sees a
system screen naming Stilltime when they grant it. Stilltime never requests it
silently and never works around it.

### What Stilltime blocks from release builds

Expo's bare-app template ships network and overlay permissions "for convenience".
Stilltime removes them from the **release** build via
`plugins/withReleaseOnlyBlockedPermissions.js`, which writes
`tools:node="remove"` markers into `app/src/release/AndroidManifest.xml`:

| Permission | Why it is removed from release |
|---|---|
| `INTERNET` | Stilltime makes no network requests |
| `ACCESS_NETWORK_STATE` | Nothing reads connectivity |
| `SYSTEM_ALERT_WINDOW` | No overlays; only present in Expo's *debug* manifest for the dev menu |

They are **not** in `android.blockedPermissions`, because that applies to every
variant — and a debug APK stripped of `INTERNET` can never reach the Metro dev
server, which would break `bun run android` entirely.

`READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` are still in
`blockedPermissions`: nothing in Stilltime touches storage, in any variant.

### What remains in a release build

After manifest merge, a release build declares:

```
android.permission.VIBRATE                                  # expo-haptics
android.permission.WRITE_SETTINGS                           # requested by Stilltime
com.stilltime.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION   # androidx.core, signature-level
```

`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` is a self-scoped, `signature`-level
permission that AndroidX `core` declares so `registerReceiver` defaults to
`RECEIVER_NOT_EXPORTED` on API 33+. Stilltime cannot exercise it from outside
its own UID. It is listed for completeness, not because the app uses it.

Debug builds additionally contain `INTERNET`, `ACCESS_NETWORK_STATE`,
`SYSTEM_ALERT_WINDOW` and `usesCleartextTraffic="true"`. These exist so the app
can reach Metro on `localhost:8081` and so the dev menu and red-box overlay
work. They are **not** in release builds.

To re-verify after any dependency change:

```bash
bun run prebuild
cd android && ./gradlew :app:processReleaseMainManifest
grep -oE 'android.permission.[A-Z_]+' \
  app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml | sort -u
```

## What Stilltime stores

All persistence is in Android `SharedPreferences`, mode `private`, inside the
app's sandbox. Nothing is written to shared or external storage.

### `stilltime_probe_prefs`

Only written when the user runs the screen-off test from the hidden testing
screen (seven taps on the build version). It holds the last test's state, when
it was armed, the expected and measured durations, and whether a restore
succeeded. It is app-internal, written only on explicit request, and removed on
uninstall.

Deliberately a *separate* file from the widget's: the widget has no reason to
know about probes, so this feature did not have to touch the widget contract
that `StilltimeWidgetContract.kt`, `src/native/widgetContract.ts` and
`plugins/widgetTemplate.js` all duplicate.

### `stilltime_widget_prefs`

Shared by the Expo module and the widget so the widget can render without the
app running.

| Key | Meaning |
|---|---|
| `applied_timeout_ms` | Last value Stilltime wrote and verified |
| `observed_timeout_ms` | Live value read from `Settings.System`; authoritative |
| `observed_at` | When that observation was taken |
| `can_write` | Whether the `WRITE_SETTINGS` grant is present |
| `stay_awake_active` | Whether a Stay Awake session is running |
| `stay_awake_started_at` | When the session began |
| `stay_awake_original_ms` | Timeout to restore when the session ends |
| `stay_awake_applied_ms` | Timeout currently held by the session |

This is a cache of system state, not a record of user behaviour. It contains no
timestamps tied to browsing, no identifiers, and nothing about how the device is
used.

## What Stilltime reads from the system

- `Settings.System.SCREEN_OFF_TIMEOUT` — the current screen timeout.
- `Build.MANUFACTURER` / `Build.MODEL` — used only to pick an OEM-specific
  hint on the diagnostics screen.
- `PowerManager.isDeviceIdleMode` — used to explain why a write may be deferred
  during Doze.
- `WRITE_SETTINGS` grant state.

No identifiers (IMEI, Android ID, advertising ID), no location, no contacts, no
clipboard, no sensor data.

## Network

None. The app declares no network permission and contains no HTTP client. There
is no telemetry endpoint, no crash reporter, and no update check.

The only outbound link is a `Linking.openURL` to
<https://github.com/nishur31> in the footer, which hands the URL to the
browser. Stilltime itself transmits nothing.

## What Stilltime refuses to do

These are product decisions, not just missing features:

- **No root, Magisk, or hidden APIs.** Every write goes through the documented
  `Settings.System` path a normal app can use.
- **No accessibility service or device-admin.** Stilltime is not asking to
  observe or control anything outside its own screen.
- **No persistent wake lock and no foreground service.** Stay Awake raises the
  screen timeout for a bounded session instead of holding the CPU awake.
- **No battery-optimisation nagging.** Stilltime does not prompt you to disable
  restrictions, and does not schedule background work to retry.
- **No background retries.** If a write fails, the app reports the failure and
  stops. It does not queue work to try again later.

## Deleting your data

Uninstalling the app removes everything. Stilltime has no server-side record to
delete, and no export or sync. To reset the settings Stilltime changed without
uninstalling, use **Power & permissions → show observed value** on the
diagnostics screen, or simply set your timeout again in Android Settings.

## Contact

Source and issue tracker: <https://github.com/nishur31>