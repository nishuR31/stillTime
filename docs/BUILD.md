# Building Stilltime

## Prerequisites

| Tool | Version used |
|---|---|
| Bun | latest |
| JDK | 21 |
| Android SDK | platform 36, build-tools for 36 |
| Gradle | supplied by the wrapper |

```bash
bun install
```

## Everyday commands

```bash
bun run verify          # typecheck + lint + tests
bun run typecheck       # tsc --noEmit
bun run lint            # expo lint
bun run test            # jest
bun run prebuild        # regenerate ./android from source (clean)
bun run android         # build + install a debug APK
```

`bun run build:debug` and `bun run build:release` invoke Gradle directly in
`android/`. Use those after prebuild has already run.

## Generated vs. tracked source

`android/` is **generated and git-ignored**. Never hand-edit it: the next
`prebuild --clean` deletes it.

| Change this | Not this |
|---|---|
| `android-widget/` for widget code | `android/app/src/main/java/**/widget/` |
| `modules/screen-timeout/` for the native module | `android/app/build/` |
| `plugins/` for prebuild behaviour | generated `android/gradle.properties` |

## The Gradle reference profile

This machine has a shared, low-memory Gradle profile at
`/home/nishu/TechStack/codes/gradle.properties`. Stilltime never modifies it.
Instead `plugins/withGradleReferenceProperties.js` reads it during prebuild,
validates the keys Stilltime depends on, and injects them into the generated
`android/gradle.properties`.

On another machine, point Stilltime at a different file:

```bash
STILLTIME_GRADLE_REFERENCE=/path/to/gradle.properties bun run prebuild
```

### It fails the build rather than guessing

The reference must exist, be non-empty, and define every required key. If it
does not, prebuild aborts with a coded error instead of quietly building with
different memory settings. Required keys:

```
org.gradle.daemon              org.gradle.jvmargs
org.gradle.parallel             org.gradle.workers.max
org.gradle.caching              android.useAndroidX
android.enablePngCrunchInReleaseBuilds
reactNativeArchitectures        hermesEnabled
newArchEnabled                  edgeToEdgeEnabled
```

The parser is a small `java.util.Properties` implementation in
`plugins/gradleReference.js`, covered by `plugins/gradleReference.test.ts`. It
handles comments, `\` continuations, quoting, and the `=` > `:` > whitespace
separator precedence — `org.gradle.jvmargs` contains `=` inside its value, so
that precedence matters.

### Precedence

1. Stilltime's explicit overrides (`expo.webp.enabled=false`)
2. The reference file's own values
3. Expo's generated defaults

The plugin **merges** into `modResults` rather than replacing it, so keys
contributed by `expo-build-properties` (for example `android.compileSdkVersion`)
survive. An earlier version replaced the array wholesale and silently dropped
the SDK pin.

## SDK pinning

`app.config.ts` registers `expo-build-properties` with
`android.compileSdkVersion: 36` and `android.targetSdkVersion: 36`.

The values must be nested under `android`. `expo-build-properties` reads its
*plugin props*, and passing them flat silently does nothing.

Expo 57 enables New Architecture and edge-to-edge by default, so there is no
`newArchEnabled` field to set.

Verify what actually landed:

```bash
bun run prebuild
cd android && ./gradlew :app:properties | grep -i sdk
```

## Android SDK levels

| Level | Value | Source |
|---|---|---|
| minSdk | 24 (Android 7.0) | Expo default |
| compileSdk | 36 | `expo-build-properties` |
| targetSdk | 36 | `expo-build-properties` |

Platform 37.1 is installed on this machine but is a preview. Stilltime pins 36
deliberately.

## Why the config plugins are CommonJS

`app.config.ts` is TypeScript, but the plugins under `plugins/` are plain
`.js` with JSDoc types, and they are registered by explicit `.js` extension.

Expo loads the app config through `@expo/require-utils`, which transpiles
`app.config.ts` but then resolves its imports with Node's CommonJS resolver.
An extensionless `require('./plugins/withFoo')` does not find a `.ts` file, and
a `.ts` plugin that imports another `.ts` file fails with `ERR_MODULE_NOT_FOUND`.

Consequences worth remembering:

- Keep `plugins/*.js` dependency-free of anything under `src/`.
- The widget contract appears in three places on purpose: the Kotlin source, the
  app-side `src/native/widgetContract.ts`, and `plugins/widgetTemplate.js`.
  `src/native/widgetContract.test.ts` asserts all three agree, so the
  duplication cannot drift.

## Verifying permissions

`docs/PRIVACY.md` lists the permissions Stilltime declares, read from the
merged release manifest. Re-check after any dependency change:

```bash
bun run prebuild
cd android && ./gradlew :app:processReleaseMainManifest
grep -oE 'android.permission.[A-Z_]+' \
  app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml | sort -u
```

A release build must show `WRITE_SETTINGS` and `VIBRATE`, and **no**
`INTERNET`. If `INTERNET` appears, something has re-added it — note that
`android.blockedPermissions` applies to *every* variant, so `INTERNET` and
`SYSTEM_ALERT_WINDOW` are removed by
`plugins/withReleaseOnlyBlockedPermissions.js` instead, which writes
`app/src/release/AndroidManifest.xml`. Putting them in `blockedPermissions`
instead silently breaks `bun run android`: a debug APK with no `INTERNET`
cannot reach Metro.

## Release builds

```bash
# 1. Generate the keystore once. Never commit it.
keytool -genkey -v -keystore stilltime-release.keystore \
  -alias stilltime -keyalg RSA -keysize 2048 -validity 10000

# 2. Point Gradle at it (e.g. in ~/.gradle/gradle.properties).
#    STILLTIME_STORE_FILE=/absolute/path/stilltime-release.keystore
#    STILLTIME_STORE_PASSWORD=...
#    STILLTIME_KEY_ALIAS=stilltime
#    STILLTIME_KEY_PASSWORD=...

# 3. Build.
bun run prebuild
bun run build:release
```

The APK lands at `android/app/build/outputs/apk/release/`. `*.keystore`,
`*.apk` and `*.aab` are git-ignored.

Bump `version` and `android.versionCode` in `app.config.ts` for each release;
Play requires a strictly increasing `versionCode`.

## Troubleshooting

**`Native module "StilltimeTimeout" is unavailable on android` on a real APK**

The APK built and installed fine, but `src/native/screenTimeout.ts` could not
find the module, so the dial screen renders its fatal-error state instead.

Expo Modules are **not** published on React Native's `NativeModules`. A Kotlin
`expo.modules.kotlin.modules.Module` is registered by the Expo Modules
installer on the JSI host object `globalThis.expo.modules`, which is the only
place `requireOptionalNativeModule` looks. `NativeModules[MODULE_NAME]` always
returns `undefined`, so a release build that contains the module, the autolinked
`ExpoModulesPackageList` entry and the embedded JS bundle still reports the
module as missing.

Confirm the chain end to end after `bun run prebuild`:

```bash
# 1. the JS looks the module up the supported way
grep -n "requireOptionalNativeModule" ../src/native/screenTimeout.ts

# 2. autolinking found the module
node ../node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js search --platform android

# 3. the module class is registered in the APK
unzip -p app/build/outputs/apk/release/app-release.apk 'classes*.dex' \
  | strings | grep -x StilltimeTimeout
```

`Constant("...")` entries are exported as plain read-only **properties** on the
module object, not behind `getConstants()`. `src/native/screenTimeout.ts`
reads them directly for that reason.

**The screen-off test never produces a result**

Expected when the process is killed before the screen goes dark — the probe
reports itself as `stale` in that case rather than hanging. Also expected if the
screen comes back on first (`interrupted`): Android restarts its idle timer on
any touch, so the measurement would be meaningless and the UI refuses to show
the partial number.

To check the receiver is registered at all, look for the `StilltimeProbe` tag in
logcat while the test is armed.

**`Cannot find module './plugins/...'` during prebuild**
A config plugin was reintroduced as `.ts`, or is imported without the `.js`
extension. See the section above.

**`Gradle reference rejected (REFERENCE_MISSING_KEY)`**
The machine profile is missing keys Stilltime depends on. Fix the reference or
point `STILLTIME_GRADLE_REFERENCE` elsewhere. Do not bypass the check.

**Widget missing from the launcher**
Re-run prebuild; the widget is copied in by a plugin, not tracked under
`android/`. Confirm `android/app/src/main/res/xml/timeout_widget_info.xml`
exists.

**`WRITE_SETTINGS` not granted**
It is an app-op permission granted from
`Settings.ACTION_MANAGE_WRITE_SETTINGS`, not a runtime dialog. The app links
there from the permission card.

**`assembleDebug` times out**
Building four ABIs (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`) means four
native C++ builds for Reanimated and Worklets. On a low-memory machine this can
exceed 20 minutes. That is expected, not a failure. To iterate on a single ABI:

```bash
cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

**`AAPT: error: resource style/Widget not found`**
A dotted style name (`Widget.Preset`) implicitly inherits from the style named
by its prefix. `android-widget/res/values/widget_strings.xml` therefore declares
an empty base `Widget` style. Adding a new dotted style without a base will fail
resource linking the same way.

**Out of memory during build**
The reference profile caps the heap at 2 GB and disables parallel Gradle by
design for this machine. Raising it will be ignored — the plugin's values win.