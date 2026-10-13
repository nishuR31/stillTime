/**
 * The "tap the build number seven times" gesture.
 *
 * Same idea Android uses for Developer options: a hidden entry point that
 * cannot be hit by accident and leaves no visible affordance until the user is
 * clearly part-way through.
 *
 * Two details matter for it to feel right:
 *   - the counter resets after a pause, so an accidental tap an hour apart
 *     never accumulates;
 *   - feedback only appears part-way through. Saying nothing for the first few
 *     taps keeps the gesture invisible; counting down afterwards tells someone
 *     who found it that they are on the right track.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TapSequenceOptions {
  /** Taps needed to fire. */
  required: number;
  /** A longer gap than this resets the count. */
  windowMs?: number;
  /** Keep counting down visibly once this many taps have landed. */
  revealAfter?: number;
  onComplete: () => void;
}

export interface TapSequence {
  /** Taps still needed, or `null` while the gesture is still hidden. */
  remaining: number | null;
  /** Taps recorded so far in the current run. */
  count: number;
  onPress: () => void;
}

export function useTapSequence({
  required,
  windowMs = 2_500,
  revealAfter = 4,
  onComplete,
}: TapSequenceOptions): TapSequence {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const lastTapRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The completion callback is usually an inline closure; reading it from a ref
  // keeps `onPress` stable so it can sit directly on a `Pressable`.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    countRef.current = 0;
    setCount(0);
  }, [clearTimer]);

  // A pending timer must never fire into an unmounted tree.
  useEffect(() => clearTimer, [clearTimer]);

  const onPress = useCallback(() => {
    const now = Date.now();
    const withinWindow = now - lastTapRef.current <= windowMs;
    lastTapRef.current = now;

    const next = withinWindow ? countRef.current + 1 : 1;
    countRef.current = next;

    if (next >= required) {
      reset();
      onCompleteRef.current();
      return;
    }

    setCount(next);
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      countRef.current = 0;
      setCount(0);
    }, windowMs);
  }, [clearTimer, required, reset, windowMs]);

  return {
    count,
    remaining: count >= revealAfter ? required - count : null,
    onPress,
  };
}
