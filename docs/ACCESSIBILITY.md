# Accessibility

Stilltime's primary control is a circular dial, which is a poor target for
people who cannot perform precise gestures. Accessibility is therefore a design
constraint on the control itself, not a pass added at the end.

## Targets

`MIN_TOUCH_TARGET` is `48`dp (`src/theme/tokens.ts`), above the 44dp minimum
Material and iOS guidelines. Every interactive element in `primitives.tsx` and
`TimeoutDial.tsx` is sized against it, including the −/+ steppers that sit
outside the dial ring.

Buttons additionally use `hitSlop` so small visual elements keep a comfortable
activation area.

## Operating the dial

The dial is not the only way to change the value.

| Method | Needs |
|---|---|
| Drag the dial | Precise pointing |
| `−` / `+` buttons | Basic touch |
| Preset buttons | Basic touch |
| Screen-reader increment / decrement actions | No gesture at all |

The dial is exposed as a single element with:

- `accessibilityRole="adjustable"`
- `accessibilityLabel="Screen timeout"`
- `accessibilityValue={{ text }}` with the human-readable duration — "5
  minutes", not "300000"
- `accessibilityActions` of `increment` and `decrement`, handled by
  `onAccessibilityAction`, which step to the next preset on the same ladder the
  buttons use

This means a screen-reader user moves through the same well-defined values as
everyone else, rather than needing arbitrary percentages.

The dial also carries a hint — "Swipe up and down, or use the increase and
decrease buttons" — so the alternative paths are discoverable without seeing the
screen.

## Not colour alone

State is never signalled by colour alone:

- The permission state is a labelled card with an explicit **Grant
  permission** action, not just a tinted border.
- Apply buttons use a text label whose wording changes with state ("Already
  set", "Set to 15s"), so the state is in the accessibility tree.
- Status pills carry text.
- The Stay Awake control is a labelled toggle with a state, not an icon swap.

## Motion

`useTheme()` subscribes to `AccessibilityInfo` and tracks
`reduceMotionEnabled`, including live changes via `reduceMotionChanged`.
Animations that would otherwise animate are skipped when a user has asked for
reduced motion. The app does not use parallax, looping, or attention-seeking
motion.

## Feedback

Notices are surfaced in a `Banner` with a title and detail rather than a
transient toast, so they are present when a screen reader reaches them and do
not vanish before being read.

Buttons expose `accessibilityState={{ disabled }}`, so "cannot apply right now"
is announced instead of leaving the control silently inert.

## Text and contrast

- Durations are formatted for reading ("5 minutes", "1 hour 30 minutes"), not
  as raw milliseconds.
- Both light and dark palettes are provided; `useTheme()` follows the system
  `Appearance` and updates at runtime.
- Foreground/background pairs were chosen for contrast in both schemes. Muted
  text is used only for supporting detail, never for the value the user is
  being asked to confirm.

## Known limitations

- The dial is a continuous gesture. A user who cannot drag at all must use the
  buttons, presets, or screen-reader actions — all of which reach every
  supported value, so no value is reachable *only* by dragging.
- Stilltime has not been audited with a physical screen reader (TalkBack) on a
  device. The accessibility tree is built and unit-tested, but real-device
  verification is still outstanding.

## Testing

`src/state/DialScreen.test.tsx` asserts the accessibility surface of the dial
screen — labels, hints, and disabled state — so a refactor that drops an
`accessibilityLabel` fails the build rather than shipping silently.