/**
 * Shared layout for the read-only information screens.
 *
 * About, how-to-use, permissions, security, privacy and terms all have the same
 * shape: a back link, a title, prose, and a navigation list at the bottom. Only
 * the words differ, so only the words live in the route files.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  BackLink,
  Banner,
  Card,
  LinkRow,
  MutedText,
  Screen,
  SectionTitle,
} from './primitives';
import type { Theme } from '../theme/useTheme';

export interface InfoSection {
  heading: string;
  /** Paragraphs, in order. */
  body?: readonly string[];
  /** Bullet points, appended after the paragraphs. */
  bullets?: readonly string[];
}

export interface InfoLink {
  label: string;
  hint?: string;
  onPress: () => void;
}

export interface InfoPageProps {
  theme: Theme;
  title: string;
  /** Shown directly under the title, before any section. */
  intro?: string;
  sections?: readonly InfoSection[];
  /** Navigation list rendered under a "More" heading. */
  links?: readonly InfoLink[];
  /**
   * Renders a prominent notice that the copy has not been reviewed by a
   * lawyer. Set on every page whose text is a draft.
   */
  draft?: boolean;
  draftNote?: string;
  onBack: () => void;
}

export const DEFAULT_DRAFT_NOTE =
  'Draft copy. It describes what this build actually does, but it has not been reviewed by a ' +
  'lawyer. Read it as an explanation, not as a binding agreement.';

export function InfoPage({
  theme,
  title,
  intro,
  sections = [],
  links = [],
  draft = false,
  draftNote = DEFAULT_DRAFT_NOTE,
  onBack,
}: InfoPageProps): React.JSX.Element {
  return (
    <Screen theme={theme}>
      <BackLink theme={theme} onPress={onBack} />

      <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
        {title}
      </Text>

      {intro ? <MutedText theme={theme}>{intro}</MutedText> : null}

      {draft ? (
        <Banner theme={theme} tone="warning" title="Draft — review before publishing" detail={draftNote} />
      ) : null}

      {sections.map((section) => (
        <Card key={section.heading} theme={theme}>
          <SectionTitle theme={theme}>{section.heading}</SectionTitle>
          {section.body?.map((paragraph, index) => (
            <MutedText key={`${section.heading}-p-${index}`} theme={theme}>
              {paragraph}
            </MutedText>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={styles.bullet}>
              <Text style={[styles.bulletMark, { color: theme.colors.accent }]}>•</Text>
              <MutedText theme={theme} style={styles.bulletText}>
                {bullet}
              </MutedText>
            </View>
          ))}
        </Card>
      ))}

      {links.length > 0 ? (
        <Card theme={theme}>
          <SectionTitle theme={theme}>More</SectionTitle>
          <View style={styles.links}>
            {links.map((link) => (
              <LinkRow
                key={link.label}
                theme={theme}
                label={link.label}
                hint={link.hint}
                onPress={link.onPress}
              />
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  bullet: {
    flexDirection: 'row',
    gap: 8,
  },
  bulletMark: {
    fontSize: 14,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
  },
  links: {
    gap: 10,
  },
});
