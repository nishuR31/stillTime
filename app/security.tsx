/**
 * Security notes.
 *
 * Describes the design constraints the app was actually built under, plus the
 * honest limits of those constraints. A security page that only lists virtues
 * is marketing; this one lists both.
 */

import { router } from 'expo-router';
import React from 'react';

import { InfoPage } from '../src/components/InfoPage';
import { useStilltime } from '../src/state/StilltimeProvider';
import { useTheme } from '../src/theme/useTheme';

export default function SecurityScreen(): React.JSX.Element {
  const theme = useTheme();
  const { sdkInt, manufacturer } = useStilltime();

  return (
    <InfoPage
      theme={theme}
      onBack={() => router.back()}
      title="Security notes"
      intro="What Stilltime is built not to do, and the few places where that has real limits."
      sections={[
        {
          heading: 'No network, structurally',
          body: [
            'A release build ships without the INTERNET permission, so there is no HTTP client that could work. There is no analytics SDK, no crash reporter, no update check and no telemetry endpoint in the app.',
            'The only outbound link in the app hands a URL to your browser. Stilltime itself transmits nothing.',
          ],
        },
        {
          heading: 'No privilege escalation',
          body: [
            'Every system access goes through documented public Android APIs. No root, no Magisk, no hidden APIs, no shell, no Runtime.exec, no reflection into framework internals.',
            'The app never asks for device administrator, accessibility service, or usage access. Those would let it observe or control the device beyond its own screen.',
          ],
        },
        {
          heading: 'No persistent background presence',
          body: [
            'No foreground service, no wake lock, no KEEP_SCREEN_ON, no AlarmManager, no JobScheduler. When Stilltime is closed it holds no resources and runs no code.',
            'Stay Awake works by writing one longer timeout and remembering how to undo it, not by keeping the CPU awake.',
          ],
        },
        {
          heading: 'Writes are verified',
          body: [
            'Settings.System.putInt returning true does not mean the value stuck — OEM policy and battery managers discard writes silently. Stilltime reads the value back and reports failure rather than claiming success.',
            'When restoring a previous value, it only does so if the live timeout still matches what it wrote. If you changed it elsewhere, your value wins.',
          ],
        },
        {
          heading: 'Storage',
          body: [
            'Everything is stored in Android SharedPreferences, mode private, inside the app sandbox. Nothing is written to shared or external storage, so no other app can read it.',
            'The contents are a cache of system state: the last value written, the last value observed, and Stay Awake session bookkeeping. No identifiers, no history of use.',
          ],
        },
        {
          heading: 'Honest limits',
          body: [
            'Writing a system setting is inherently visible: Android shows a system screen when you grant the permission, and the setting remains changed after you close the app. Uninstalling restores nothing on its own — if you want your old timeout back, set it again.',
            'A third party with the same permission could change the same setting. Stilltime detects that and refuses to overwrite your change, but it cannot prevent it.',
            'The widget and the app share one preferences file so the widget can render without the app running. Both are inside the same sandbox and the same uid, so this does not widen the trust boundary.',
            'Stilltime is not obfuscated and ships a readable source repository. That is deliberate, not an oversight.',
          ],
        },
        {
          heading: 'This device',
          body: [
            `Android SDK ${sdkInt || 'unknown'}${manufacturer ? `, ${manufacturer}` : ''}. Manufacturer skins are the most common reason a verified write still behaves unexpectedly; the Power & permissions screen shows the live signals.`,
          ],
        },
      ]}
      links={[
        {
          label: 'About Stilltime',
          onPress: () => router.push('/about'),
        },
        {
          label: 'Permissions',
          onPress: () => router.push('/permissions'),
        },
        {
          label: 'Privacy',
          onPress: () => router.push('/privacy'),
        },
      ]}
    />
  );
}
