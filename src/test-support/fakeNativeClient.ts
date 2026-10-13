/**
 * In-memory fake of the native module.
 *
 * Models the parts of Android Stilltime actually depends on — a stored timeout
 * and a permission grant — including the failure modes that matter: a write
 * that silently does not stick, and a timeout the user changed elsewhere.
 */

import type { StilltimeClient } from '../native/client';
import { StilltimeError } from '../native/errors';
import type {
  ApplyResult,
  PermissionSnapshot,
  PowerSnapshot,
  ScreenOffProbeResult,
  StayAwakeState,
  StopStayAwakeResult,
  TimeoutSnapshot,
} from '../native/types';
import { createMemoryStorage, type SessionStorage } from '../state/sessionStore';

export interface FakeClientOptions {
  observedMs?: number;
  canWrite?: boolean;
  sdkInt?: number;
  manufacturer?: string;
  power?: PowerSnapshot;
  /** When true, `applyTimeout` throws instead of writing. */
  failApply?: boolean;
  /** When true, `applyTimeout` pretends to succeed but does not change the value. */
  swallowWrites?: boolean;
  storage?: SessionStorage;
  /** Starting probe state, so a test can render a completed run. */
  probe?: ScreenOffProbeResult;
}

export interface FakeClient extends StilltimeClient {
  readonly state: {
    observedMs: number;
    canWrite: boolean;
    applied: number[];
    startedStayAwake: boolean;
    probe: ScreenOffProbeResult;
    probeArmed: number[];
  };
  /** Simulate the user changing the timeout outside the app. */
  setObserved(ms: number): void;
  setCanWrite(canWrite: boolean): void;
  /** Replace the probe state, e.g. to simulate the screen going off. */
  setProbe(probe: ScreenOffProbeResult): void;
  storage: SessionStorage;
}

const DEFAULTS = {
  observedMs: 300_000,
  canWrite: true,
  sdkInt: 36,
  manufacturer: 'Google',
};

/** Shape the native side returns before anything has been run. */
export function idleProbe(): ScreenOffProbeResult {
  return {
    state: 'idle',
    expectedMs: null,
    measuredMs: null,
    screenOffAtWallMs: null,
    screenOnAtWallMs: null,
    armedAtWallMs: null,
    restoreToMs: null,
    restored: false,
    note: '',
  };
}

export function createFakeClient(options: FakeClientOptions = {}): FakeClient {
  const config = { ...DEFAULTS, ...options };
  let observedMs = config.observedMs;
  let canWrite = config.canWrite;
  const applied: number[] = [];
  let session: StayAwakeState | null = null;
  const storage = options.storage ?? createMemoryStorage();
  let probe: ScreenOffProbeResult = options.probe ?? idleProbe();
  const probeArmed: number[] = [];

  const permission = (): PermissionSnapshot => ({ canWrite, sdkInt: config.sdkInt });

  const snapshot = (requestedMs?: number): TimeoutSnapshot => ({
    observedMs,
    requestedMs: requestedMs ?? observedMs,
    appliedMs: observedMs,
    verified: true,
    canWrite,
    outsideDialBounds: observedMs < 15_000 || observedMs > 3_600_000,
    sdkInt: config.sdkInt,
    manufacturer: config.manufacturer,
  });

  const stayAwake = (): StayAwakeState =>
    session ?? {
      active: false,
      startedAt: null,
      originalMs: null,
      appliedMs: null,
      observedMs,
      drifted: false,
      remainingMs: null,
    };

  const power = (): PowerSnapshot =>
    options.power ?? {
      powerSaveMode: false,
      deviceIdleMode: false,
      ignoringBatteryOptimizations: false,
      sdkInt: config.sdkInt,
      manufacturer: config.manufacturer,
    };

  const client: FakeClient = {
    isNativeAvailable: true,
    storage,

    state: {
      get observedMs() {
        return observedMs;
      },
      get canWrite() {
        return canWrite;
      },
      applied,
      get startedStayAwake() {
        return session?.active ?? false;
      },
      get probe() {
        return probe;
      },
      probeArmed,
    } as FakeClient['state'],

    setObserved(ms: number) {
      observedMs = ms;
    },

    setCanWrite(value: boolean) {
      canWrite = value;
    },

    setProbe(next: ScreenOffProbeResult) {
      probe = next;
    },

    async getPermissionState() {
      return permission();
    },

    async requestWritePermission() {
      canWrite = true;
      return permission();
    },

    async openWriteSettings() {},

    async openBatterySettings() {},

    async getTimeoutSnapshot(requestedMs?: number) {
      return snapshot(requestedMs);
    },

    async applyTimeout(requestedMs: number): Promise<ApplyResult> {
      if (!canWrite) {
        throw new StilltimeError(
          'E_PERMISSION_REQUIRED',
          'No WRITE_SETTINGS grant.',
          'Allow Stilltime to modify system settings, then try again.',
        );
      }
      if (options.failApply === true) {
        throw new StilltimeError(
          'E_VERIFY_FAILED',
          'Wrote but the device reports a different value.',
          'The value did not stick.',
        );
      }
      if (options.swallowWrites !== true) {
        observedMs = requestedMs;
      }
      applied.push(requestedMs);
      return { snapshot: snapshot(requestedMs), stayAwake: stayAwake() };
    },

    async getPowerState() {
      return power();
    },

    async getStayAwakeState() {
      return stayAwake();
    },

    async startStayAwake(requestedMs?: number): Promise<ApplyResult> {
      if (!canWrite) {
        throw new StilltimeError('E_PERMISSION_REQUIRED', 'No WRITE_SETTINGS grant.', 'Grant it.');
      }
      const original = observedMs;
      const target = requestedMs ?? 1_800_000;
      observedMs = target;
      applied.push(target);
      session = {
        active: true,
        startedAt: 1_700_000_000_000,
        originalMs: original,
        appliedMs: target,
        observedMs: target,
        drifted: false,
        remainingMs: target,
      };
      storage.setItem(
        'stilltime.session.v1',
        JSON.stringify({
          startedAt: session.startedAt,
          originalMs: original,
          requestedMs: target,
          appliedMs: target,
        }),
      );
      return { snapshot: snapshot(target), stayAwake: session };
    },

    async stopStayAwake(): Promise<StopStayAwakeResult> {
      const current = stayAwake();
      if (!current.active) {
        session = null;
        return {
          restoredMs: null,
          skipped: false,
          inactive: true,
          snapshot: snapshot(),
          stayAwake: stayAwake(),
        };
      }

      const drifted = current.appliedMs !== observedMs;
      if (drifted || current.originalMs === null) {
        session = null;
        storage.removeItem('stilltime.session.v1');
        return {
          restoredMs: null,
          skipped: true,
          inactive: true,
          snapshot: snapshot(),
          stayAwake: {
            ...current,
            active: false,
            drifted: true,
            observedMs,
            remainingMs: null,
          },
        };
      }

      observedMs = current.originalMs;
      applied.push(current.originalMs);
      session = null;
      storage.removeItem('stilltime.session.v1');
      return {
        restoredMs: current.originalMs,
        skipped: false,
        inactive: true,
        snapshot: snapshot(current.originalMs),
        stayAwake: stayAwake(),
      };
    },

    async reconcileStayAwake() {
      return stayAwake();
    },

    notifyWidgets(timeoutMs: number) {
      void timeoutMs;
    },

    async startScreenOffProbe(expectedMs: number, restoreToMs: number | null = null) {
      probeArmed.push(expectedMs);
      probe = {
        ...idleProbe(),
        state: 'armed',
        expectedMs,
        restoreToMs,
        armedAtWallMs: 1_700_000_000_000,
      };
      return probe;
    },

    async getScreenOffProbe() {
      return probe;
    },

    async cancelScreenOffProbe() {
      probe = { ...probe, state: 'cancelled' };
      return probe;
    },
  };

  return client;
}