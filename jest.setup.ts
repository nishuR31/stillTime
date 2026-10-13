/**
 * Notes for this suite:
 *
 * - `render` from @testing-library/react-native v14 is **async**. Always
 *   `await` it, otherwise the `screen` binding is still the pre-render stub and
 *   every query throws "`render` function has not been called".
 * - v13+ registers its matchers automatically, so there is no `extend-expect`
 *   import to add here.
 */

// expo-haptics is a native module; stub it so component tests never touch a
// device. Stilltime calls these fire-and-forget.
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));