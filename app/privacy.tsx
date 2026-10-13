/**
 * Privacy.
 *
 * Every claim here is checkable against the code or against the merged release
 * manifest, and `docs/PRIVACY.md` explains how. Marked draft because the
 * *wording* has not been through a lawyer, not because the behaviour is
 * uncertain.
 */

import { router } from 'expo-router';
import React from 'react';

import { InfoPage } from '../src/components/InfoPage';
import { useTheme } from '../src/theme/useTheme';

export default function PrivacyScreen(): React.JSX.Element {
  const theme = useTheme();

  return (
    <InfoPage
      theme={theme}
      onBack={() => router.back()}
      title="Privacy"
      draft
      draftNote="Draft copy describing this build. The behaviour is accurate; the wording has not been reviewed by a lawyer."
      intro="Stilltime has no account, no analytics, no crash reporting, and no network permission in a release build."
      sections={[
        {
          heading: 'Nothing leaves the device',
          body: [
            'A release APK does not declare the INTERNET permission, so it cannot make a network request at all. There is no server to send anything to.',
            'There is no analytics SDK, no crash reporter, no advertising identifier, and no update check.',
          ],
        },
        {
          heading: 'What Stilltime reads from Android',
          bullets: [
            'The current screen timeout, to display and verify it',
            'Whether the Modify system settings grant is present',
            'Battery Saver and Doze state, and the battery-optimisation exemption, for the diagnostics screen only',
            'The manufacturer string, to pick an OEM-specific hint',
            'The Android SDK level',
          ],
        },
        {
          heading: 'What Stilltime does not read',
          bullets: [
            'No identifiers — IMEI, Android ID, advertising ID',
            'No location, contacts, photos, files, clipboard or sensors',
            'No app list, no usage history, no network state',
            'No other system settings',
          ],
        },
        {
          heading: 'What is stored on the device',
          body: [
            'A single private SharedPreferences file inside the app sandbox. It holds the last timeout Stilltime wrote, the last timeout it observed, when it observed it, whether the permission grant is present, and Stay Awake session bookkeeping.',
            'That is a cache of system state, not a record of how you use your phone. It contains no history, no identifiers, and nothing tied to your browsing.',
            'A second, separate file holds screen-off test results. It is only written when you run that test.',
          ],
        },
        {
          heading: 'Who else can see it',
          body: [
            'Nobody. The file is private to the app sandbox, and no other app can read it. Uninstalling Stilltime deletes all of it immediately.',
          ],
        },
        {
          heading: 'Deleting your data',
          body: [
            'Uninstall the app and everything goes with it. There is no account to close, no export, and no sync.',
            'Uninstalling does not restore the screen timeout Stilltime changed. Set it back from Android Settings, or from the app before you remove it.',
          ],
        },
      ]}
      links={[
        {
          label: 'About Stilltime',
          onPress: () => router.push('/about'),
        },
        {
          label: 'Security notes',
          onPress: () => router.push('/security'),
        },
        {
          label: 'Terms of use',
          onPress: () => router.push('/terms'),
        },
      ]}
    />
  );
}
