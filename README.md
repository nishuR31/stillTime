# Stilltime

An Android app for changing the system screen timeout — without opening Android
Settings.

Stilltime shows the timeout your device is *actually* using, lets you drag or tap
to a new value, and writes it to `Settings.System.SCREEN_OFF_TIMEOUT` through a
verified read-back. It also offers a bounded **Stay Awake** session and a
home-screen widget that works even when the app is not running.

Stilltime is offline by design. See [docs/PRIVACY.md](docs/PRIVACY.md).

---

## What it does

- **Dial control.** A logarithmic dial maps 15 s – 60 min. Equal distance on the
  dial means equal *ratio*, so the short end of the range is not crushed into a
  few unusable degrees.
- **Honest reporting.** *Requested*, *applied* and *observed* are three
  different numbers. When a manufacturer ignores the write, Stilltime shows
  what the device really has rather than what was asked for.
- **Stay Awake.** Raises the timeout for a session capped at 30 minutes, then
  restores the previous value. Refuses to restore over a value the user
  changed elsewhere.
- **Widget.** Quick presets and a Stay Awake toggle from the home screen, using
  `RemoteViews` so it does not depend on the React Native runtime.
- **Diagnostics.** A screen that explains what was observed, whether a write
  can succeed on this OEM build, and which Settings page to open.
- **Screen-off test.** Hidden behind seven taps on the build version. It times
  the real idle-to-screen-off period using the `ACTION_SCREEN_OFF` broadcast and
  reports whether the device actually honours the value Stilltime wrote — the
  one thing a read-back cannot prove.
- **Transparency pages.** About, how-to-use, permissions, security, privacy and
  draft terms, all reachable from the dial screen, each describing what this
  build actually does.

## What it deliberately does not do

Stilltime does not use root, Magisk, hidden APIs, accessibility services,
device-admin, a persistent wake lock, a foreground service, analytics, or any
network access. It does not nag you about battery optimisation. Those choices
are the reason it is a small app instead of a power tool; see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#what-stilltime-refuses-to-do).

## Requirements

| | |
|---|---|
| Platform | Android only (no iOS project is generated) |
| Min SDK | 24 (Android 7.0) |
| Compile / target SDK | 36 |
| Build | Expo SDK 57, React Native 0.86, Kotlin Expo Modules API |
| Permissions | `WRITE_SETTINGS` and `VIBRATE` — see [docs/PRIVACY.md](docs/PRIVACY.md) |

`WRITE_SETTINGS` is a special app-op permission. It is granted from the System
Settings page, not from a runtime dialog, so the app has a visible screen for
exactly that.

## Quick start

```bash
bun install
bun run prebuild        # generates ./android from source
bun run verify          # typecheck + lint + tests
bun run android         # build and install a debug APK
```

See [docs/BUILD.md](docs/BUILD.md) for the full build and release process.

## Project layout

```
app/                        Expo Router screens
  index.tsx                 timeout dial (the only screen most users see)
  power.tsx                 power & permission diagnostics
  testing.tsx               screen-off test (7 taps on the build version)
  about.tsx                 about + index of the transparency pages
  how-to-use.tsx            how to use it, in order
  permissions.tsx           what is asked for, and what is not
  security.tsx              design constraints and their real limits
  privacy.tsx               what is read and stored (draft copy)
  terms.tsx                 terms of use (draft copy, needs a lawyer)
  +not-found.tsx            unmatched deep links
src/
  domain/                   pure logic: bounds, dial scale, stay-awake,
                            stay-awake machine, probe verdicts
  native/                   typed bridge, error model, widget contract
  state/                    reducer, provider, durable session storage
  components/               dial, shared UI primitives, info-page scaffold
  theme/                    colour tokens, dark/light, reduced motion
modules/screen-timeout/     Kotlin Expo module (timeout engine, permissions,
                            screen-off probe)
android-widget/             widget sources and resources (tracked template)
plugins/                    Gradle reference loader, widget injector,
                            release-only permission block
docs/                       architecture, privacy, accessibility, build
```

`android/` is generated and git-ignored. Edit `android-widget/` and
`modules/`, never `android/`.

## Documentation

| Document | Covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layering, data flow, the requested/applied/observed contract, widget IPC |
| [docs/PRIVACY.md](docs/PRIVACY.md) | Permissions, data storage, what is blocked and verified |
| [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | Dial semantics, targets, reduced motion, screen-reader behaviour |
| [docs/BUILD.md](docs/BUILD.md) | Prebuild, config plugins, Gradle profile, release signing |

## Tests

```bash
bun run test
```

124 tests across pure domain logic, the Gradle reference parser, the widget
contract (pinned against the Kotlin source), the reducer, session storage, and
a component smoke test of the dial screen.

## Source

<https://github.com/nishur31>