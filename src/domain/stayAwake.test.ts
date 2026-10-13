import {
  clampStayAwakeRequest,
  isSessionActive,
  reconcileSession,
  STAY_AWAKE_REASON,
  STAY_AWAKE_TIMEOUT_MS,
  startSession,
  stopSession,
  type StayAwakeSession,
} from './stayAwake';
import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from './timeouts';

const NOW = 1_700_000_000_000;

function session(overrides: Partial<StayAwakeSession> = {}): StayAwakeSession {
  return {
    startedAt: NOW,
    originalMs: 300_000,
    requestedMs: STAY_AWAKE_TIMEOUT_MS,
    appliedMs: STAY_AWAKE_TIMEOUT_MS,
    observedMs: STAY_AWAKE_TIMEOUT_MS,
    status: 'active',
    ...overrides,
  };
}

describe('clampStayAwakeRequest', () => {
  it('caps at the documented ceiling', () => {
    expect(clampStayAwakeRequest(MAX_TIMEOUT_MS)).toBe(STAY_AWAKE_TIMEOUT_MS);
    expect(clampStayAwakeRequest(60_000)).toBe(60_000);
  });

  it('never goes below the dial floor', () => {
    expect(clampStayAwakeRequest(1)).toBe(MIN_TIMEOUT_MS);
  });
});

describe('startSession', () => {
  it('remembers the previous value so it can be undone', () => {
    const { writeMs, session: created } = startSession(300_000, STAY_AWAKE_TIMEOUT_MS, NOW);
    expect(writeMs).toBe(STAY_AWAKE_TIMEOUT_MS);
    expect(created.originalMs).toBe(300_000);
    expect(created.appliedMs).toBe(STAY_AWAKE_TIMEOUT_MS);
    expect(created.status).toBe('active');
  });

  it('writes a value even when the current timeout is already the ceiling', () => {
    const { writeMs, session: created } = startSession(STAY_AWAKE_TIMEOUT_MS, STAY_AWAKE_TIMEOUT_MS, NOW);
    expect(writeMs).toBe(STAY_AWAKE_TIMEOUT_MS);
    expect(created.originalMs).toBe(STAY_AWAKE_TIMEOUT_MS);
  });
});

describe('reconcileSession', () => {
  it('is a no-op when there is no session', () => {
    const decision = reconcileSession(null, 300_000);
    expect(decision.writeMs).toBeNull();
    expect(decision.nextSession).toBeNull();
    expect(decision.reason).toBe(STAY_AWAKE_REASON.notActive);
  });

  it('is idempotent when the live value still matches what we applied', () => {
    const decision = reconcileSession(session(), STAY_AWAKE_TIMEOUT_MS);
    expect(decision.writeMs).toBeNull();
    expect(decision.nextSession?.status).toBe('active');
    expect(decision.reason).toBe(STAY_AWAKE_REASON.stillActive);
  });

  it('never re-applies a drifted value', () => {
    const decision = reconcileSession(session(), 60_000);
    expect(decision.writeMs).toBeNull();
    expect(decision.nextSession?.status).toBe('drifted');
    expect(decision.nextSession?.observedMs).toBe(60_000);
  });
});

describe('stopSession', () => {
  it('restores the original value when nothing else changed', () => {
    const decision = stopSession(session(), STAY_AWAKE_TIMEOUT_MS);
    expect(decision.writeMs).toBe(300_000);
    expect(decision.nextSession?.status).toBe('restored');
    expect(decision.reason).toBe(STAY_AWAKE_REASON.restored);
  });

  it('refuses to clobber a value the user changed elsewhere', () => {
    const decision = stopSession(session(), 60_000);
    expect(decision.writeMs).toBeNull();
    expect(decision.nextSession?.status).toBe('skipped_user_changed');
    expect(decision.reason).toBe(STAY_AWAKE_REASON.skippedUserChanged);
  });

  it('is safe to call twice', () => {
    const first = stopSession(session(), STAY_AWAKE_TIMEOUT_MS);
    expect(first.writeMs).toBe(300_000);

    // After the restore the live value is `originalMs`, which no longer equals
    // `appliedMs`, so a second stop must not write again.
    const second = stopSession(
      { ...first.nextSession!, appliedMs: STAY_AWAKE_TIMEOUT_MS },
      300_000,
    );
    expect(second.writeMs).toBeNull();
    expect(second.nextSession?.status).toBe('skipped_user_changed');
  });

  it('treats an unknown observation conservatively', () => {
    const decision = stopSession(session(), null);
    expect(decision.writeMs).toBe(300_000);
  });
});

describe('isSessionActive', () => {
  it('counts both active and drifted as active', () => {
    expect(isSessionActive(session())).toBe(true);
    expect(isSessionActive(session({ status: 'drifted' }))).toBe(true);
    expect(isSessionActive(session({ status: 'restored' }))).toBe(false);
    expect(isSessionActive(null)).toBe(false);
  });
});