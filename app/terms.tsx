/**
 * Terms of use — DRAFT.
 *
 * Written deliberately in plain language and deliberately incomplete. The
 * sections that need a real lawyer (governing law, liability caps, consumer
 * rights, how disputes are handled) are named as placeholders rather than
 * invented, because a plausible-looking wrong clause is worse than an obvious
 * gap.
 *
 * `DEFAULT_DRAFT_NOTE` on the page says the same thing to the reader.
 */

import { router } from 'expo-router';
import React from 'react';

import { InfoPage } from '../src/components/InfoPage';
import { useTheme } from '../src/theme/useTheme';

export default function TermsScreen(): React.JSX.Element {
  const theme = useTheme();

  return (
    <InfoPage
      theme={theme}
      onBack={() => router.back()}
      title="Terms of use"
      draft
      draftNote="Draft copy. The sections marked TODO need a lawyer and your jurisdiction before this page is published. Do not ship it as-is."
      intro="Plain-language terms for a free, offline utility that changes one Android setting."
      sections={[
        {
          heading: 'What Stilltime is',
          body: [
            'Stilltime is free software provided as-is. It reads and writes your device screen-off timeout using documented Android APIs.',
            'You keep every right you have to the device. Granting the Modify system settings permission is yours to give and yours to revoke at any time.',
          ],
        },
        {
          heading: 'Acceptable use',
          body: ['Stilltime does what it says. The following are about your own device and your own risk.'],
          bullets: [
            'Do not use a modified timeout in a way that creates a safety problem — for example, leaving a display on where it would be a hazard. A screen that never turns off drains the battery and, in rare cases, is used to keep a device awake.',
            'Do not redistribute a signed Stilltime APK under your own name. The source is public and you may build your own version for yourself.',
            'Do not rely on Stilltime to keep a display alive for anything that matters. It raises a timeout; it does not guarantee one.',
          ],
        },
        {
          heading: 'Disclaimer',
          body: [
            'Stilltime is provided without warranty of any kind, express or implied, including fitness for a particular purpose. It is a diagnostic utility, not a safety device.',
            'Manufacturer firmware, battery managers and Android itself can override or defer a write. Stilltime detects this where it can and reports it, but it cannot prevent it.',
            'Set your screen timeout to something you have verified works on your device.',
          ],
        },
        {
          heading: 'Limitation of liability',
          body: [
            'TODO — requires legal input. This needs a governing-law clause, a jurisdiction, a cap on liability, and whatever consumer-law carve-outs your jurisdiction requires. Do not publish this page without them.',
          ],
        },
        {
          heading: 'Privacy',
          body: [
            'Stilltime collects nothing. The Privacy page lists exactly what is read and stored, and that list is short because there is no network permission in a release build.',
          ],
        },
        {
          heading: 'Warranty disclaimer',
          body: [
            'TODO — requires legal input. Confirm this covers open-source distribution in your jurisdiction, and whether the implied warranties can be excluded here.',
          ],
        },
        {
          heading: 'Changes',
          body: [
            'These terms ship inside the app, so they change only when the app does. Uninstalling removes them along with everything else.',
          ],
        },
      ]}
      links={[
        {
          label: 'About Stilltime',
          onPress: () => router.push('/about'),
        },
        {
          label: 'Privacy',
          onPress: () => router.push('/privacy'),
        },
        {
          label: 'Security notes',
          onPress: () => router.push('/security'),
        },
      ]}
    />
  );
}
