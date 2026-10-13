/**
 * What Stilltime asks Android for, and what it deliberately does not.
 *
 * The "does not" list is the more useful half. A release build carries no
 * network permission at all, which is checkable rather than promised — see
 * `docs/PRIVACY.md` for how to re-verify it against the merged manifest.
 */

import { router } from 'expo-router';
import React from 'react';

import { InfoPage } from '../src/components/InfoPage';
import { useStilltime } from '../src/state/StilltimeProvider';
import { useTheme } from '../src/theme/useTheme';

export default function PermissionsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { canWrite } = useStilltime();

  return (
    <InfoPage
      theme={theme}
      onBack={() => router.back()}
      title="Permissions"
      intro="Stilltime needs two permissions. Neither of them lets it see anything you do."
      sections={[
        {
          heading: 'Modify system settings — WRITE_SETTINGS',
          body: [
            'This is the only permission Stilltime genuinely needs. The screen timeout lives in Settings.System.SCREEN_OFF_TIMEOUT, and Android requires this grant before any app may write it.',
            'Stilltime uses it for that one key and nothing else. It cannot read your location, your messages, your files, or any other setting.',
          ],
        },
        {
          heading: 'Currently granted on this device',
          body: [
            canWrite
              ? 'Stilltime can read and write the screen timeout on this device.'
              : 'Stilltime can read the screen timeout but not write it. Grant it from the main screen to use the dial.',
          ],
        },
        {
          heading: 'Vibrate — VIBRATE',
          body: [
            'Used only for the small tap feedback when you cross a dial detent, pick a preset, or finish writing a value. expo-haptics calls the platform vibrator, which Android refuses to do without this grant.',
            'No permission is needed to grant it, and Stilltime never vibrates on its own or on a timer.',
          ],
        },
        {
          heading: 'What a release build does not ask for',
          body: [
            'These are removed from the shipped APK. A debug build keeps INTERNET and the overlay permission so it can talk to the development server, but a release build has no way to make a network request even if code tried.',
          ],
          bullets: [
            'INTERNET — no network requests are possible',
            'ACCESS_NETWORK_STATE — nothing reads connectivity',
            'SYSTEM_ALERT_WINDOW — no overlays, no floating windows',
            'READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE — no file access',
            'Camera, microphone, location, contacts, phone, storage — never requested',
            'QUERY_ALL_PACKAGES — not requested',
          ],
        },
        {
          heading: 'How to change your mind',
          body: [
            'Revoke Modify system settings from the same system page Stilltime sends you to, or from Android Settings → Apps → Stilltime → Permissions. Revoking it costs you nothing but the ability to write.',
            'Uninstalling removes the grant along with everything else.',
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
          label: 'Privacy',
          onPress: () => router.push('/privacy'),
        },
      ]}
    />
  );
}
