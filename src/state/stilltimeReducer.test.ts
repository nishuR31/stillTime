import {
  clampTimeout,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
} from '../domain/timeouts';
import {
  initialStilltimeState,
  isDirty,
  stilltimeReducer,
  toSession,
  type StilltimeAction,
  type StilltimeState,
} from './stilltimeReducer';
import type { PermissionSnapshot, TimeoutSnapshot } from '../native/types';

const permission: PermissionSnapshot = { canWrite: true, sdkInt: 36 };
const timeout = (observedMs: number, requestedMs = observedMs): TimeoutSnapshot => ({
  observedMs,
  requestedMs,
  appliedMs: observedMs,
  verified: true,
  canWrite: true,
  outsideDialBounds: false,
  sdkInt: 36,
  manufacturer: 'Google',
});

function reduce(state: StilltimeState, ...actions: StilltimeAction[]): StilltimeState {
  return actions.reduce(stilltimeReducer, state);
}

describe('load/success', () => {
  it('becomes ready and seeds the draft from the observed value', () => {
    const state = reduce(initialStilltimeState, {
      type: 'load/success',
      permission,
      timeout: timeout(300_000),
      power: null,
      stayAwake: null,
      powerGuidance: null,
    });

    expect(state.status).toBe('ready');
    expect(state.observedMs).toBe(300_000);
    expect(state.draftMs).toBe(300_000);
    expect(state.canWrite).toBe(true);
    expect(state.appliedMs).toBeNull();
  });

  it('flags a device value outside the dial bounds', () => {
    const state = reduce(initialStilltimeState, {
      type: 'load/success',
      permission,
      timeout: timeout(1_000),
      power: null,
      stayAwake: null,
      powerGuidance: null,
    });

    expect(state.outsideDialBounds).toBe(true);
    expect(state.draftMs).toBe(MIN_TIMEOUT_MS);
  });
});

describe('draft handling', () => {
  const ready = reduce(initialStilltimeState, {
    type: 'load/success',
    permission,
    timeout: timeout(300_000),
    power: null,
    stayAwake: null,
    powerGuidance: null,
  });

  it('clamps a draft value into range', () => {
    expect(stilltimeReducer(ready, { type: 'draft/set', draftMs: 0 }).draftMs).toBe(MIN_TIMEOUT_MS);
    expect(stilltimeReducer(ready, { type: 'draft/set', draftMs: 9_000_000 }).draftMs).toBe(
      MAX_TIMEOUT_MS,
    );
  });

  it('reports dirty only when the draft differs from the device', () => {
    expect(isDirty(ready)).toBe(false);
    const edited = stilltimeReducer(ready, { type: 'draft/set', draftMs: 60_000 });
    expect(isDirty(edited)).toBe(true);
  });

  it('does not snap the draft while the user is dragging', () => {
    const dragging = reduce(ready, { type: 'draft/begin' }, { type: 'draft/set', draftMs: 60_000 });
    expect(dragging.dragging).toBe(true);

    const observed = stilltimeReducer(dragging, {
      type: 'timeout/observed',
      observedMs: 900_000,
    });
    expect(observed.draftMs).toBe(60_000);
    expect(observed.observedMs).toBe(900_000);
  });

  it('snaps the draft once the drag ends', () => {
    const settled = reduce(
      ready,
      { type: 'draft/begin' },
      { type: 'draft/set', draftMs: 60_000 },
      { type: 'draft/end' },
    );
    expect(settled.dragging).toBe(false);

    const observed = stilltimeReducer(settled, {
      type: 'timeout/observed',
      observedMs: 900_000,
    });
    expect(observed.draftMs).toBe(clampTimeout(900_000));
  });
});

describe('apply', () => {
  it('clears busy and records the applied value on success', () => {
    const state = reduce(
      initialStilltimeState,
      { type: 'apply/start' },
      { type: 'apply/success', observedMs: 60_000, appliedMs: 60_000, outsideDialBounds: false },
    );

    expect(state.busy).toBe(false);
    expect(state.appliedMs).toBe(60_000);
    expect(state.draftMs).toBe(60_000);
    expect(state.observedMs).toBe(60_000);
  });

  it('clears busy and shows the error notice on failure', () => {
    const notice = { id: 'x', tone: 'error' as const, title: 'No', detail: 'Nope' };
    const state = reduce(initialStilltimeState, { type: 'apply/start' }, {
      type: 'apply/failure',
      notice,
    });

    expect(state.busy).toBe(false);
    expect(state.notice).toEqual(notice);
  });
});

describe('notices', () => {
  it('can be dismissed', () => {
    const state = reduce(
      initialStilltimeState,
      { type: 'notice/show', notice: { id: 'a', tone: 'info', title: 't', detail: 'd' } },
      { type: 'notice/dismiss' },
    );
    expect(state.notice).toBeNull();
  });
});

describe('load/failure', () => {
  it('records a fatal error without losing the notice slot', () => {
    const state = stilltimeReducer(initialStilltimeState, {
      type: 'load/failure',
      message: 'Native module unavailable',
    });
    expect(state.status).toBe('error');
    expect(state.fatalError).toBe('Native module unavailable');
  });
});

describe('toSession', () => {
  it('maps an active session to the active status', () => {
    expect(
      toSession({
        active: true,
        startedAt: 1,
        originalMs: 300_000,
        appliedMs: 1_800_000,
        observedMs: 1_800_000,
        drifted: false,
        remainingMs: 1_800_000,
      })?.status,
    ).toBe('active');
  });

  it('maps a drifted session to the drifted status', () => {
    expect(
      toSession({
        active: true,
        startedAt: 1,
        originalMs: 300_000,
        appliedMs: 1_800_000,
        observedMs: 60_000,
        drifted: true,
        remainingMs: null,
      })?.status,
    ).toBe('drifted');
  });

  it('returns null when there is no session', () => {
    expect(
      toSession({
        active: false,
        startedAt: null,
        originalMs: null,
        appliedMs: null,
        observedMs: 300_000,
        drifted: false,
        remainingMs: null,
      }),
    ).toBeNull();
  });
});