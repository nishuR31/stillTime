/** @type {import('jest').Config} */
module.exports = {
  // Stilltime is Android-only, so run tests against the Android platform
  // resolution rather than the preset's iOS default.
  preset: 'jest-expo/android',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-worklets|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|standard-navigation|expo-router))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/native/screenTimeout.ts',
    '!src/test-support/**',
  ],
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/plugins/**/*.test.ts',
  ],
  clearMocks: true,
};