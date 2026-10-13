/**
 * Reducer for Stilltime's app state.
 *
 * Pure and synchronous so it can be unit-tested without a device. All async
 * work lives in the provider; the reducer only decides what a result *means*.
 */

import { clampTimeout, isWithinBounds, MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from '../domain/timeouts';
import type { StayAwakeSession } from '../domain/stayAwake';
import type { PowerGuidance } from '../domain/powerPolicy';
import type {
  PermissionSnapshot,
  PowerSnapshot,
  StayAwakeState,
  TimeoutSnapshot,
} from '../native/types';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Notice {
  /** Stable id so repeated identical notices do not re-announce. */
  id: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  detail: string;
}

export interface StilltimeState {
  status: LoadStatus;

  /** Live value read from Settings.System. */
  observedMs: number | null;
  /** Value the dial is showing while the user is dragging. */
  draftMs: number;
  /** Value most recently applied by the user. */
  appliedMs: number | null;
  /** True when the live value is outside the dial bounds. */
  outsideDialBounds: boolean;

  canWrite: boolean;
  sdkInt: number;
  manufacturer: string;

  /** True while an apply/stay-awake request is in flight. */
  busy: boolean;
  /** True while the user is dragging the dial. */
  dragging: boolean;

  power: PowerSnapshot | null;
  powerGuidance: PowerGuidance | null;

  stayAwake: StayAwakeState | null;

  notice: Notice | null;
  fatalError: string | null;
}

export const initialStilltimeState: StilltimeState = {
  status: 'idle',
  observedMs: null,
  draftMs: MIN_TIMEOUT_MS,
  appliedMs: null,
  outsideDialBounds: false,
  canWrite: false,
  sdkInt: 0,
  manufacturer: '',
  busy: false,
  dragging: false,
  power: null,
  powerGuidance: null,
  stayAwake: null,
  notice: null,
  fatalError: null,
};

export type StilltimeAction =
  | { type: 'load/start' }
  | { type: 'load/failure'; message: string }
  | {
      type: 'load/success';
      permission: PermissionSnapshot;
      timeout: TimeoutSnapshot;
      power: PowerSnapshot | null;
      stayAwake: StayAwakeState | null;
      powerGuidance: PowerGuidance | null;
    }
  | { type: 'permission/changed'; canWrite: boolean }
  | { type: 'timeout/observed'; observedMs: number; draftMs?: number }
  | { type: 'draft/set'; draftMs: number }
  | { type: 'draft/begin' }
  | { type: 'draft/end' }
  | { type: 'apply/start' }
  | {
      type: 'apply/success';
      observedMs: number;
      appliedMs: number;
      outsideDialBounds: boolean;
    }
  | { type: 'apply/failure'; notice: Notice }
  | { type: 'power/update'; power: PowerSnapshot; guidance: PowerGuidance }
  | { type: 'stayAwake/update'; stayAwake: StayAwakeState; draftMs?: number }
  | { type: 'notice/show'; notice: Notice }
  | { type: 'notice/dismiss' };

function applyObserved(observedMs: number): Pick<
  StilltimeState,
  'observedMs' | 'outsideDialBounds'
> {
  return {
    observedMs,
    outsideDialBounds: !isWithinBounds(observedMs),
  };
}

export function stilltimeReducer(
  state: StilltimeState,
  action: StilltimeAction,
): StilltimeState {
  switch (action.type) {
    case 'load/start':
      return { ...state, status: 'loading', fatalError: null };

    case 'load/failure':
      return { ...state, status: 'error', fatalError: action.message };

    case 'load/success': {
      const outside = applyObserved(action.timeout.observedMs);
      return {
        ...state,
        ...outside,
        status: 'ready',
        draftMs: clampTimeout(action.timeout.observedMs),
        appliedMs: null,
        canWrite: action.permission.canWrite,
        sdkInt: action.permission.sdkInt,
        manufacturer: action.timeout.manufacturer,
        power: action.power,
        powerGuidance: action.powerGuidance,
        stayAwake: action.stayAwake,
        fatalError: null,
      };
    }

    case 'permission/changed':
      return { ...state, canWrite: action.canWrite };

    case 'timeout/observed': {
      const observed = applyObserved(action.observedMs);
      const next = { ...state, ...observed };
      // Only snap the dial when the user is not actively dragging.
      if (action.draftMs !== undefined) {
        return { ...next, draftMs: action.draftMs };
      }
      if (!state.dragging) {
        return { ...next, draftMs: clampTimeout(action.observedMs) };
      }
      return next;
    }

    case 'draft/set':
      return { ...state, draftMs: clampTimeout(action.draftMs) };

    case 'draft/begin':
      return { ...state, dragging: true };

    case 'draft/end':
      return { ...state, dragging: false };

    case 'apply/start':
      return { ...state, busy: true, notice: null };

    case 'apply/success':
      return {
        ...state,
        busy: false,
        ...applyObserved(action.observedMs),
        appliedMs: action.appliedMs,
        draftMs: clampTimeout(action.appliedMs),
      };

    case 'apply/failure':
      return { ...state, busy: false, notice: action.notice };

    case 'power/update':
      return { ...state, power: action.power, powerGuidance: action.guidance };

    case 'stayAwake/update': {
      const next: StilltimeState = { ...state, stayAwake: action.stayAwake };
      if (action.draftMs !== undefined) {
        next.draftMs = clampTimeout(action.draftMs);
      }
      return next;
    }

    case 'notice/show':
      return { ...state, notice: action.notice };

    case 'notice/dismiss':
      return { ...state, notice: null };

    default:
      return state;
  }
}

/** True when the dial shows something different from the live device value. */
export function isDirty(state: StilltimeState): boolean {
  if (state.observedMs === null) return false;
  return clampTimeout(state.observedMs) !== state.draftMs;
}

export function isOverLimit(state: StilltimeState): boolean {
  return state.draftMs >= MAX_TIMEOUT_MS;
}

export function isUnderLimit(state: StilltimeState): boolean {
  return state.draftMs <= MIN_TIMEOUT_MS;
}

/** Convert a session snapshot into the domain shape used by the UI copy. */
export function toSession(state: StayAwakeState): StayAwakeSession | null {
  if (state.startedAt === null || state.appliedMs === null) return null;
  return {
    startedAt: state.startedAt,
    originalMs: state.originalMs ?? state.appliedMs,
    requestedMs: state.appliedMs,
    appliedMs: state.appliedMs,
    observedMs: state.observedMs,
    status: state.active ? (state.drifted ? 'drifted' : 'active') : 'idle',
  };
}