/**
 * How to use Stilltime, end to end.
 *
 * Written for someone who has never seen the app, in the order they will
 * actually do things, including the part people trip over: the grant is an
 * app-op permission, not a runtime dialog, so Android shows a settings screen
 * instead of a popup.
 */

import { router } from 'expo-router';
import React from 'react';

import { InfoPage } from '../src/components/InfoPage';
import { useTheme } from '../src/theme/useTheme';

export default function HowToUseScreen(): React.JSX.Element {
  const theme = useTheme();

  return (
    <InfoPage
      theme={theme}
      onBack={() => router.back()}
      title="How to use it"
      sections={[
        {
          heading: '1. Grant the permission',
          body: [
            'Android will not let any app change a system setting unless you explicitly allow it. Tap Grant permission on the main screen, then turn on the toggle for Stilltime on the system page.',
            'This is an app-op permission, not the install-time popup you may be used to. Android always shows you a screen naming Stilltime, so nothing is granted silently.',
          ],
        },
        {
          heading: '2. Pick a value',
          body: [
            'Turn the dial, or tap one of the presets. The dial is logarithmic, so the short timeouts get as much of the circle as the long ones: one detent near the top moves by seconds, one near the bottom by minutes.',
            'The dial covers the full circle and the full range, from 15 seconds to 1 hour. It cannot be set outside that range.',
          ],
        },
        {
          heading: '3. Apply it',
          body: [
            'Tap Set. Stilltime writes the value and immediately reads it back. It will only report success when the device reports the value it just wrote.',
            'If the device reports something else, the write was rejected or deferred — Battery Saver, Doze, or a manufacturer policy — and Stilltime says so rather than pretending.',
          ],
        },
        {
          heading: '4. Check what the device thinks',
          body: [
            'The dial shows the value still in sync when the draft matches the device, and device <value> when it does not. The Power & permissions screen shows the same number read straight from Android.',
          ],
        },
        {
          heading: 'Stay Awake',
          body: [
            'Stay Awake raises the timeout to 30 minutes while you use the app, then puts your previous value back. It does not run a background service and does not hold a wake lock, so it cannot keep the screen on after you leave.',
            'If you change the timeout somewhere else while a session is running, Stilltime refuses to write over your change and tells you instead.',
          ],
        },
        {
          heading: 'The home-screen widget',
          body: [
            'Long-press your home screen, choose Widgets, and find Stilltime. The widget shows the value the device currently holds and can set the four common timeouts or toggle Stay Awake without opening the app.',
          ],
        },
        {
          heading: 'If the value will not stick',
          body: [
            'Open Power & permissions. It reports Battery Saver, Doze, the battery-optimisation exemption, the Android version and the manufacturer, and explains which of those is most likely deferring your write.',
            'A screen-off test is available too: tap the build version in the footer seven times to open it. It times how long the screen really stays on and tells you whether the device is honouring what you set.',
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
          label: 'Power & permissions',
          hint: 'Live diagnostics on this device.',
          onPress: () => router.push('/power'),
        },
      ]}
    />
  );
}
