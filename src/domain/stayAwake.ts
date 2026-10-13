/**
 * Stay Awake: a bounded, self-healing long-screen session.
 *
 * Stilltime deliberately does *not* use a foreground service, a wake lock, or
 * `FLAG_KEEP_SCREEN_ON`. Any of those would keep the display alive after the
 * user leaves the app, which is not what "keep the screen on while I'm using
 * this app" means and is exactly the kind of hidden battery drain users
 * distrust.
 *
 * Instead Stay Awake writes one long, documented timeout and remembers enough
 * state to undo it safely:
 *
 *   - `originalMs` — what the device had before we touched it
 *   - `requestedMs` — what the user asked for
 *   - `appliedMs`  — what we actually wrote and read back
 *
 * On stop we restore `originalMs` **only** when the live timeout still equals
 * `appliedMs`. If the user changed the timeout elsewhere, we refuse to clobber
 * their change and report `SKIPPED_USER_CHANGED`.
 *
 * The state machine is pure so it can be unit-tested without a device and so
 * the same rules apply whether the request came from the UI, a lifecycle
 * callback, or a widget tap.
 */

import { clampTimeout, MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from './timeouts';

/** Documented ceiling for a Stay Awake session. */
export const STAY_AWAKE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export type StayAwakeStatus =
  /** A session is running and the live timeout matches what we applied. */
  | 'active'
  /** The live timeout no longer matches `appliedMs`; something else changed it. */
  | 'drifted'
  /** We restored `originalMs` successfully. */
  | 'restored'
  /** We refused to restore because the live timeout changed underneath us. */
  | 'skipped_user_changed'
  /** No session recorded. */
  | 'idle';

export interface StayAwakeSession {
  /** Epoch ms when the session started. */
  startedAt: number;
  /** Timeout the device had before the session. */
  originalMs: number;
  /** What the user asked for (clamped to the Stay Awake ceiling). */
  requestedMs: number;
  /** What we wrote and verified by reading back. */
  appliedMs: number;
  /** Live timeout observed now, or `null` when unknown. */
  observedMs: number | null;
  status: StayAwakeStatus;
}

export interface StayAwakeDecision {
  /** The timeout that should be written now, or `null` to write nothing. */
  writeMs: number | null;
  nextSession: StayAwakeSession | null;
  /** Human-readable reason, surfaced in the UI and the widget. */
  reason: string;
}

export const STAY_AWAKE_REASON = {
  started: 'Stay Awake is on. The screen will stay on for up to 30 minutes.',
  stillActive: 'Stay Awake is still active.',
  restored: 'Previous timeout restored.',
  drifted: 'The screen timeout was changed elsewhere, so Stay Awake will not restore over it.',
  skippedUserChanged:
    'The screen timeout was changed outside Stilltime, so the previous value was left alone.',
  alreadyActive: 'Stay Awake is already on.',
  notActive: 'Stay Awake is not active.',
} as const;

export function clampStayAwakeRequest(requestedMs: number): number {
  return Math.min(STAY_AWAKE_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, clampTimeout(requestedMs)));
}

export function isSessionActive(session: StayAwakeSession | null): boolean {
  return session?.status === 'active' || session?.status === 'drifted';
}

function withObserved(
  session: StayAwakeSession,
  observedMs: number | null,
): StayAwakeSession {
  if (observedMs === null) return session;
  if (observedMs === session.appliedMs) return { ...session, observedMs, status: 'active' };
  return { ...session, observedMs, status: 'drifted' };
}

/**
 * Decide what to do on app start / foreground / manual "refresh".
 *
 * - No session: nothing to do.
 * - Session whose live value still matches: idempotent no-op.
 * - Session whose live value drifted: leave the user's value alone and mark
 *   the session as drifted so the UI can offer a clean stop.
 */
export function reconcileSession(
  session: StayAwakeSession | null,
  observedMs: number | null,
): StayAwakeDecision {
  if (!session) {
    return { writeMs: null, nextSession: null, reason: STAY_AWAKE_REASON.notActive };
  }

  const refreshed = withObserved(session, observedMs);

  if (refreshed.status === 'active') {
    return {
      writeMs: null,
      nextSession: refreshed,
      reason: STAY_AWAKE_REASON.stillActive,
    };
  }

  return {
    writeMs: null,
    nextSession: refreshed,
    reason: STAY_AWAKE_REASON.drifted,
  };
}

/** Begin a session: write the ceiling and remember how to undo it. */
export function startSession(
  currentMs: number,
  requestedMs: number,
  now: number,
): { writeMs: number; session: StayAwakeSession } {
  const originalMs = clampTimeout(currentMs);
  const writeMs = clampStayAwakeRequest(requestedMs);

  return {
    writeMs,
    session: {
      startedAt: now,
      originalMs,
      requestedMs: writeMs,
      appliedMs: writeMs,
      observedMs: writeMs,
      status: 'active',
    },
  };
}

/**
 * End a session.
 *
 * Restores `originalMs` only when the device still holds `appliedMs`.
 */
export function stopSession(
  session: StayAwakeSession,
  observedMs: number | null,
): StayAwakeDecision {
  const refreshed = withObserved(session, observedMs);

  if (refreshed.status === 'drifted') {
    return {
      writeMs: null,
      nextSession: { ...refreshed, status: 'skipped_user_changed' },
      reason: STAY_AWAKE_REASON.skippedUserChanged,
    };
  }

  const restoreTo = clampTimeout(refreshed.originalMs);
  return {
    writeMs: restoreTo,
    nextSession: {
      ...refreshed,
      observedMs: restoreTo,
      appliedMs: restoreTo,
      status: 'restored',
    },
    reason: STAY_AWAKE_REASON.restored,
  };
}

/**
 * Milliseconds the current session still relies on the device timeout for.
 *
 * This is the applied timeout itself, not a wall-clock countdown: the session
 * ends when the timeout lapses, when the user stops it, or when Android changes
 * the value underneath it.
 */
export function sessionRemainingMs(session: StayAwakeSession | null): number | null {
  if (!session || !isSessionActive(session)) return null;
  return Math.max(0, session.appliedMs);
}

/** A stay-awake session is never allowed to outlive the global ceiling. */
export function isWithinCeiling(ms: number): boolean {
  return ms >= MIN_TIMEOUT_MS && ms <= MAX_TIMEOUT_MS;
}