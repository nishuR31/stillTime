/**
 * Root layout.
 *
 * SafeAreaProvider + StilltimeProvider wrap every screen so the state machine is
 * created exactly once. The background is set from the resolved theme before
 * first paint to avoid a white flash in dark mode.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StilltimeProvider } from '../src/state/StilltimeProvider';
import { useTheme } from '../src/theme/useTheme';

export default function RootLayout(): React.JSX.Element {
  const theme = useTheme();

  return (
    <SafeAreaProvider>
      <StilltimeProvider>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: theme.reduceMotion ? 'none' : 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="power" options={{ presentation: 'card' }} />
          <Stack.Screen name="about" />
          <Stack.Screen name="how-to-use" />
          <Stack.Screen name="permissions" />
          <Stack.Screen name="security" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="terms" />
          {/* Hidden behind seven taps on the build version. */}
          <Stack.Screen name="testing" options={{ gestureEnabled: true }} />
        </Stack>
      </StilltimeProvider>
    </SafeAreaProvider>
  );
}