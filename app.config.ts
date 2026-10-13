import type { ConfigContext, ExpoConfig } from 'expo/config';
import type { ConfigPlugin } from 'expo/config-plugins';

import withGradleReferenceProperties from './plugins/withGradleReferenceProperties.js';
import withReleaseOnlyBlockedPermissions from './plugins/withReleaseOnlyBlockedPermissions.js';
import withStilltimeAndroid from './plugins/withStilltimeAndroid.js';

const PACKAGE = 'com.stilltime.app';
const VERSION = '1.0.0';
const BUILD_NUMBER = 1;

/** Splash backgrounds, kept in step with `src/theme/tokens.ts`. */
const LIGHT_BACKGROUND = '#F4F2EE';
const DARK_BACKGROUND = '#111210';

/**
 * Absolute path to the machine-wide Gradle reference that
 * `withGradleReferenceProperties` reads. Override with
 * `STILLTIME_GRADLE_REFERENCE` on another machine.
 */
const GRADLE_REFERENCE_PATH =
  process.env.STILLTIME_GRADLE_REFERENCE ?? '/home/nishu/TechStack/codes/gradle.properties';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: 'Stilltime',
    slug: 'stilltime',
    version: VERSION,
    scheme: 'stilltime',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    platforms: ['android'],
    icon: './assets/icon.png',
    android: {
      package: PACKAGE,
      versionCode: BUILD_NUMBER,
      adaptiveIcon: {
        backgroundColor: '#111210',
        foregroundImage: './assets/adaptive-icon.png',
        monochromeImage: './assets/monochrome-icon.png',
      },
      predictiveBackGestureEnabled: true,
      softwareKeyboardLayoutMode: 'pan',
      // Stilltime is offline by design. The network and overlay permissions are
      // removed from *release* builds by `withReleaseOnlyBlockedPermissions`
      // rather than here: `blockedPermissions` applies to every variant, and a
      // debug APK stripped of `INTERNET` can never reach the Metro dev server.
      // WRITE_SETTINGS is the only permission Stilltime asks for; see
      // `docs/PRIVACY.md`.
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: false,
          data: [{ scheme: 'stilltime' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    // `ExpoConfig['plugins']` is typed as strings and tuples, but config
    // plugins are first-class: `ConfigPlugin` is exactly what it accepts.
    plugins: [
      'expo-router',
      // SDK 36 is the newest stable platform this machine has installed; pin it
      // so a newer preview platform is never picked up implicitly. Registered
      // before `withGradleReferenceProperties` so the reference has the last
      // word on the keys it declares.
      [
        'expo-build-properties',
        {
          // `expo-build-properties` reads these from the *plugin props*, so they
          // must be nested under `android` rather than passed flat.
          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
          },
        },
      ],
      withGradleReferenceProperties,
      withStilltimeAndroid,
      withReleaseOnlyBlockedPermissions,
      [
        'expo-splash-screen',
        {
          // Transparent artwork so the theme background shows through. The dial
          // itself is dark in both schemes, so one image serves both; only the
          // background colour differs.
          image: './assets/splash-icon.png',
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: LIGHT_BACKGROUND,
          dark: {
            backgroundColor: DARK_BACKGROUND,
          },
        },
      ],
    ] satisfies (string | ConfigPlugin<ExpoConfig> | [string, object])[] as ExpoConfig['plugins'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      gradleReferencePath: GRADLE_REFERENCE_PATH,
    },
  };
};

export { GRADLE_REFERENCE_PATH, PACKAGE, VERSION, BUILD_NUMBER };