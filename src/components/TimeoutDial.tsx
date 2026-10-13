/**
 * The tactile timeout dial.
 *
 * Design notes:
 *   - Rotation starts at 12 o'clock and runs clockwise, so "more time" is
 *     always to the right, matching every physical dial the user has touched.
 *   - Interaction is PanResponder based (no gesture-handler dependency needed)
 *     with explicit +/- buttons and a screen-reader path via
 *     `accessibilityActions`, so it is fully operable without fine motor
 *     control.
 *   - Every visual position is derived from the value, never stored, so the
 *     rendering can never disagree with the state.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityActionEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';

import { msForPosition, pointToPosition, positionForMs, snapPosition } from '../domain/dialScale';
import {
  clampTimeout,
  formatDuration,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  stepTimeout,
} from '../domain/timeouts';
import { MIN_TOUCH_TARGET, type Theme } from '../theme/useTheme';

export interface TimeoutDialProps {
  /** Value in ms to display. */
  valueMs: number;
  /** Live value on the device, used for the "device …" delta label. */
  observedMs: number | null;
  disabled?: boolean;
  onChange: (ms: number) => void;
  /** Fired when the user crosses a detent, for haptic feedback. */
  onDetent?: () => void;
  /** Fired once when a drag begins, so the app can stop snapping the draft. */
  onDragStart?: () => void;
  /** Fired once when the drag ends. */
  onDragEnd?: () => void;
  theme: Theme;
  size?: number;
}

const TICK_COUNT = 60;
const KNOB_SIZE = 26;
const TICK_INSET = 16;

export function TimeoutDial({
  valueMs,
  observedMs,
  disabled = false,
  onChange,
  onDetent,
  onDragStart,
  onDragEnd,
  theme,
  size = 288,
}: TimeoutDialProps): React.JSX.Element {
  const sizeRef = useRef(size);
  const lastDetentRef = useRef<number | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    const next = Math.min(width, height);
    if (next > 0) sizeRef.current = next;
  }, []);

  const position = useMemo(() => positionForMs(valueMs), [valueMs]);

  const commitFromPointer = useCallback(
    (x: number, y: number, emitHaptic: boolean): void => {
      const diameter = sizeRef.current;
      const snapped = snapPosition(pointToPosition(x, y, diameter));
      const nextMs = clampTimeout(msForPosition(snapped));

      if (emitHaptic) onChange(nextMs);

      const detent = Math.round(snapped * (TICK_COUNT - 1));
      if (lastDetentRef.current !== detent) {
        lastDetentRef.current = detent;
        onDetent?.();
      }
    },
    [onChange, onDetent],
  );

  // Built in an effect instead of during render: the handlers close over refs
  // (measured diameter, last detent), and a responder must never be able to
  // read them mid-render.
  const [panResponder, setPanResponder] = useState<PanResponderInstance | null>(null);
  useEffect(() => {
    setPanResponder(
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          onDragStart?.();
          const { locationX, locationY } = event.nativeEvent;
          commitFromPointer(locationX, locationY, true);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          commitFromPointer(locationX, locationY, true);
        },
        onPanResponderRelease: () => {
          lastDetentRef.current = null;
          onDragEnd?.();
        },
        onPanResponderTerminate: () => {
          lastDetentRef.current = null;
          onDragEnd?.();
        },
      }),
    );
  }, [commitFromPointer, disabled, onDragEnd, onDragStart]);

  const nudge = useCallback(
    (direction: 1 | -1): void => {
      if (disabled) return;
      onChange(stepTimeout(valueMs, direction));
      onDetent?.();
    },
    [disabled, onChange, onDetent, valueMs],
  );

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent): void => {
      if (event.nativeEvent.actionName === 'increment') nudge(1);
      else if (event.nativeEvent.actionName === 'decrement') nudge(-1);
    },
    [nudge],
  );

  const knob = knobGeometry(position, size);
  const isAtMax = valueMs >= MAX_TIMEOUT_MS;
  const isAtMin = valueMs <= MIN_TIMEOUT_MS;
  const hasDelta = observedMs !== null && observedMs !== valueMs;

  const valueText = [
    formatDuration(valueMs),
    isAtMin ? 'at the minimum' : isAtMax ? 'at the maximum' : null,
    hasDelta ? `device currently ${formatDuration(observedMs as number)}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      <View
        style={[
          styles.dial,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.colors.surfaceRaised,
            borderColor: disabled ? theme.colors.border : theme.colors.borderStrong,
            shadowColor: theme.colors.shadow,
            shadowOpacity: theme.scheme === 'dark' ? 0.45 : 0.1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          },
        ]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Screen timeout"
        accessibilityHint="Swipe up and down, or use the increase and decrease buttons."
        accessibilityValue={{ text: valueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        {...(disabled || panResponder === null ? {} : panResponder.panHandlers)}
      >
        <DialTicks theme={theme} size={size} />

        <View
          style={[
            styles.knob,
            {
              width: KNOB_SIZE,
              height: KNOB_SIZE,
              borderRadius: KNOB_SIZE / 2,
              left: knob.x,
              top: knob.y,
              backgroundColor: disabled ? theme.colors.surfaceSunken : theme.colors.dialKnob,
              borderColor: theme.colors.dialProgress,
              shadowColor: theme.colors.shadow,
              shadowOpacity: 0.3,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            },
          ]}
          pointerEvents="none"
        />

        <View style={styles.centre} pointerEvents="none">
          <Text
            style={[styles.value, { color: theme.colors.text }]}
            importantForAccessibility="no-hide-descendants"
          >
            {formatDuration(valueMs)}
          </Text>
          <Text
            style={[styles.caption, { color: theme.colors.textMuted }]}
            importantForAccessibility="no-hide-descendants"
          >
            {hasDelta ? `device ${formatDuration(observedMs as number)}` : 'in sync'}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <DialButton
          label="–"
          accessibilityLabel="Decrease screen timeout"
          accessibilityHint="Steps down to the previous preset"
          disabled={disabled || isAtMin}
          onPress={() => nudge(-1)}
          theme={theme}
        />
        <DialButton
          label="+"
          accessibilityLabel="Increase screen timeout"
          accessibilityHint="Steps up to the next preset"
          disabled={disabled || isAtMax}
          onPress={() => nudge(1)}
          theme={theme}
        />
      </View>
    </View>
  );
}

interface TickSpec {
  key: string;
  left: number;
  top: number;
  height: number;
  major: boolean;
}

function buildTicks(size: number): TickSpec[] {
  const centre = size / 2;
  const radius = centre - TICK_INSET;
  return Array.from({ length: TICK_COUNT }, (_, index) => {
    const position = index / (TICK_COUNT - 1);
    const angle = position * Math.PI * 2 - Math.PI / 2;
    const major = index % 5 === 0;
    const height = major ? 12 : 6;
    return {
      key: `tick-${index}`,
      left: centre + Math.cos(angle) * radius - 1,
      top: centre + Math.sin(angle) * radius - height,
      height,
      major,
    };
  });
}

function DialTicks({ theme, size }: { theme: Theme; size: number }): React.JSX.Element {
  const ticks = useMemo(() => buildTicks(size), [size]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
      {ticks.map((tick) => (
        <View
          key={tick.key}
          style={{
            position: 'absolute',
            left: tick.left,
            top: tick.top,
            width: tick.major ? 3 : 2,
            height: tick.height,
            borderRadius: 2,
            backgroundColor: tick.major ? theme.colors.textMuted : theme.colors.borderStrong,
            opacity: tick.major ? 0.85 : 0.45,
          }}
        />
      ))}
    </View>
  );
}

function DialButton({
  label,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  onPress,
  theme,
}: {
  label: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  disabled: boolean;
  onPress: () => void;
  theme: Theme;
}): React.JSX.Element {
  return (
    <PressableButton
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.dialButton,
        {
          backgroundColor: disabled ? theme.colors.surfaceSunken : theme.colors.accentSoft,
          borderColor: disabled ? theme.colors.border : theme.colors.accent,
        },
      ]}
    >
      <Text
        style={[styles.dialButtonLabel, { color: disabled ? theme.colors.textFaint : theme.colors.accent }]}
        importantForAccessibility="no-hide-descendants"
      >
        {label}
      </Text>
    </PressableButton>
  );
}

function knobGeometry(position: number, size: number): { x: number; y: number } {
  const centre = size / 2;
  const radius = centre - TICK_INSET;
  const angle = position * Math.PI * 2 - Math.PI / 2;
  return {
    x: centre + Math.cos(angle) * radius - KNOB_SIZE / 2,
    y: centre + Math.sin(angle) * radius - KNOB_SIZE / 2,
  };
}

/** Minimal Pressable wrapper so the button is a real touch target on Android. */
function PressableButton({
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  disabled,
  onPress,
  style,
  children,
}: {
  accessibilityLabel: string;
  accessibilityHint: string;
  accessibilityState?: { disabled?: boolean };
  disabled: boolean;
  onPress: () => void;
  style: object;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
      style={style}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 20,
  },
  dial: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  knob: {
    position: 'absolute',
    borderWidth: 2,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 54,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    gap: 28,
  },
  dialButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  dialButtonLabel: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
});