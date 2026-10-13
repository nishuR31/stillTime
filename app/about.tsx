/**
 * About Stilltime, and the index for every information page.
 *
 * This is the one screen a curious user can always find, so it carries the
 * build version (which is also the hidden entry point to the screen-off test)
 * and links to the rest.
 */

import { router } from 'expo-router';
import React from 'react';

import { InfoPage } from '../src/components/InfoPage';
import { getConstants } from '../src/native/screenTimeout';
import { useTheme } from '../src/theme/useTheme';

export default function AboutScreen(): React.JSX.Element {
  const theme = useTheme();
  const { appVersion, buildNumber } = getConstants();
  const version = appVersion !== 'unknown' ? appVersion : '—';
  const code = buildNumber > 0 ? ` (${buildNumber})` : '';

  return (
    <InfoPage
      theme={theme}
      onBack={() => router.back()}
      title="About Stilltime"
      intro="Stilltime changes one Android setting: how long your screen stays on when you are not touching it. That is the whole product."
      sections={[
        {
          heading: 'What it does',
          body: [
            'Android buries the screen timeout under Settings → Display → Screen timeout. Stilltime puts it on a dial you can actually turn, writes the value through the documented Settings.System API, and then reads it back to prove it stuck.',
            'Everything happens on the device. There is no account, no server, and no network permission in a release build.',
          ],
        },
        {
          heading: 'What it will not do',
          bullets: [
            'No root, Magisk, or hidden APIs',
            'No accessibility service or device administrator',
            'No foreground service, no wake lock, no background retries',
            'No analytics, crash reporting, or update checks',
          ],
        },
        {
          heading: 'Version',
          body: [`Stilltime ${version}${code}. The source is public; the footer on the main screen links to it.`],
        },
      ]}
      links={[
        {
          label: 'How to use it',
          hint: 'Grant the permission, turn the dial, verify the value.',
          onPress: () => router.push('/how-to-use'),
        },
        {
          label: 'Permissions',
          hint: 'What Stilltime asks for, and what it deliberately does not.',
          onPress: () => router.push('/permissions'),
        },
        {
          label: 'Security notes',
          hint: 'How the app is built and what it refuses to do.',
          onPress: () => router.push('/security'),
        },
        {
          label: 'Privacy',
          hint: 'What is read, what is stored, and where.',
          onPress: () => router.push('/privacy'),
        },
        {
          label: 'Terms of use',
          hint: 'Draft terms. Not reviewed by a lawyer.',
          onPress: () => router.push('/terms'),
        },
        {
          label: 'Power & permissions',
          hint: 'Why a write might have been deferred on this device.',
          onPress: () => router.push('/power'),
        },
      ]}
    />
  );
}
