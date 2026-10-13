/**
 * Catch-all route for unmatched deep links.
 *
 * Stilltime is a single-purpose app with only two destinations, so an unknown
 * path is a mistake rather than a navigation state worth restoring from. The
 * user gets one clear way back instead of a dead end.
 */

import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Footer, MutedText, Screen, SectionTitle } from '../src/components/primitives';
import { useTheme } from '../src/theme/useTheme';

export default function NotFoundScreen(): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen theme={theme} contentStyle={styles.content}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
          Nothing here
        </Text>
      </View>

      <Card theme={theme}>
        <SectionTitle theme={theme}>This link does not go anywhere</SectionTitle>
        <MutedText theme={theme}>
          Stilltime only has two screens: the timeout dial and the power diagnostics. If you followed a link
          from somewhere else, it may have been built for an older version of the app.
        </MutedText>
      </Card>

      <Button
        theme={theme}
        label="Back to the dial"
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}
        accessibilityHint="Returns to the screen timeout dial"
      />

      <Footer theme={theme} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
});