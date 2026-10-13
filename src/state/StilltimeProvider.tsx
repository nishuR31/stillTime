/**
 * Stilltime's single source of truth.
 *
 * Responsibilities:
 *   - perform every native call
 *   - refresh on mount, on foreground, and on power-state-relevant lifecycle
 *     changes
 *   - keep the UI reducer fed
 *   - keep the local session mirror in sync with the authoritative native one
 */

import * as Haptics from 'expo-haptics';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { summarisePower } from '../domain/powerPolicy';
import { STAY_AWAKE_TIMEOUT_MS } from '../domain/stayAwake';
import { clampTimeout } from '../domain/timeouts';
import type { StilltimeClient } from '../native/client';
import { nativeScreenTimeout } from '../native/screenTimeout';
import type { PowerSnapshot, StayAwakeState } from '../native/types';
import {
  createMemoryStorage,
  readSession,
  writeSession,
  type SessionStorage,
} from './sessionStore';
import {
  initialStilltimeState,
  stilltimeReducer,
  type Notice,
  type StilltimeState,
} from './stilltimeReducer';

const haptics = {
  selection: () => {
    void Haptics.selectionAsync().catch(() => undefined);
  },
  success: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  warning: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
  error: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  },
  light: () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
};

export interface StilltimeContextValue extends StilltimeState {
  client: StilltimeClient;
  setDraftMs: (ms: number) => void;
  beginDrag: () => void;
  endDrag: () => void;
  tickSelection: () => void;
  apply: () => Promise<void>;
  requestPermission: () => Promise<void>;
  openWriteSettings: () => Promise<void>;
  openBatterySettings: () => Promise<void>;
  toggleStayAwake: () => Promise<void>;
  refresh: () => Promise<void>;
  dismissNotice: () => void;
  announce: (notice: Notice) => void;
}

const StilltimeContext = createContext<StilltimeContextValue | null>(null);

export interface StilltimeProviderProps {
  children: React.ReactNode;
  /** Overridable for tests. */
  client?: StilltimeClient;
  storage?: SessionStorage;
  /** Milliseconds between background refreshes. */
  pollIntervalMs?: number;
}

const NOTICE_ID_SALT = Date.now();

function noticeId(key: string): string {
  return `${key}-${NOTICE_ID_SALT}`;
}

export function StilltimeProvider({
  children,
  client = nativeScreenTimeout,
  storage,
  pollIntervalMs = 5_000,
}: StilltimeProviderProps): React.JSX.Element {
  const [state, dispatch] = useReducer(stilltimeReducer, initialStilltimeState);
  const sessionStorage = useMemo(() => storage ?? createMemoryStorage(), [storage]);
  const mountedRef = useRef(true);
  const refreshInFlight = useRef(false);
  // Mirrors the latest state so callbacks never close over a stale snapshot.
  // Written in an effect rather than during render: user events always run
  // after commit, so the ref is never behind by the time it is read.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const syncLocalSession = useCallback(
    (stayAwake: StayAwakeState | null) => {
      if (!stayAwake) {
        writeSession(sessionStorage, null);
        return;
      }
      if (!stayAwake.active) {
        writeSession(sessionStorage, null);
        return;
      }
      writeSession(sessionStorage, {
        startedAt: stayAwake.startedAt ?? Date.now(),
        originalMs: stayAwake.originalMs ?? stayAwake.appliedMs ?? STAY_AWAKE_TIMEOUT_MS,
        requestedMs: stayAwake.appliedMs ?? STAY_AWAKE_TIMEOUT_MS,
        appliedMs: stayAwake.appliedMs ?? STAY_AWAKE_TIMEOUT_MS,
      });
    },
    [sessionStorage],
  );

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const [permission, timeout, power, stayAwake] = await Promise.all([
        client.getPermissionState(),
        client.getTimeoutSnapshot(),
        client.getPowerState().catch((): PowerSnapshot | null => null),
        client.getStayAwakeState().catch((): StayAwakeState | null => null),
      ]);

      if (!mountedRef.current) return;

      syncLocalSession(stayAwake);

      dispatch({
        type: 'load/success',
        permission,
        timeout,
        power,
        stayAwake,
        powerGuidance: power ? summarisePower(power) : null,
      });
    } catch (error) {
      if (!mountedRef.current) return;
      dispatch({
        type: 'load/failure',
        message: error instanceof Error ? error.message : 'Could not read the current screen timeout.',
      });
    } finally {
      refreshInFlight.current = false;
    }
  }, [client, syncLocalSession]);

  // Initial load. Seed the draft from the local mirror so the first frame is
  // not blank, then reconcile against the device.
  useEffect(() => {
    const local = readSession(sessionStorage);
    if (local) {
      dispatch({ type: 'stayAwake/update', stayAwake: localToState(local) });
    }
    void refresh();
  }, [refresh, sessionStorage]);

  // Foreground refresh. Android can change the timeout while we are backgrounded
  // (Settings app, other launchers, battery manager), so re-read on every resume.
  useEffect(() => {
    const onChange = (next: AppStateStatus): void => {
      if (next === 'active') {
        void refresh();
      }
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [refresh]);

  // Light polling keeps the "observed" badge honest while the app is open.
  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs, refresh]);

  const announce = useCallback((notice: Notice) => {
    dispatch({ type: 'notice/show', notice });
  }, []);

  const setDraftMs = useCallback((ms: number) => {
    dispatch({ type: 'draft/set', draftMs: ms });
  }, []);

  const beginDrag = useCallback(() => {
    dispatch({ type: 'draft/begin' });
  }, []);

  const endDrag = useCallback(() => {
    dispatch({ type: 'draft/end' });
  }, []);

  const tickSelection = useCallback(() => {
    haptics.selection();
  }, []);

  const apply = useCallback(async () => {
    const target = clampTimeout(stateRef.current.draftMs);
    dispatch({ type: 'apply/start' });
    try {
      const result = await client.applyTimeout(target);
      if (!mountedRef.current) return;
      syncLocalSession(result.stayAwake);
      dispatch({
        type: 'apply/success',
        observedMs: result.snapshot.observedMs,
        appliedMs: result.snapshot.appliedMs,
        outsideDialBounds: result.snapshot.outsideDialBounds,
      });
      dispatch({
        type: 'notice/show',
        notice: {
          id: noticeId('applied'),
          tone: 'success',
          title: 'Screen timeout updated',
          detail: `The device now turns the screen off after ${formatShort(result.snapshot.appliedMs)}.`,
        },
      });
      haptics.success();
    } catch (error) {
      if (!mountedRef.current) return;
      const notice = errorToNotice(error);
      dispatch({ type: 'apply/failure', notice });
      if (notice.tone === 'error') haptics.error();
      else haptics.warning();
    }
  }, [client, syncLocalSession]);

  const requestPermission = useCallback(async () => {
    try {
      const permission = await client.requestWritePermission();
      if (!mountedRef.current) return;
      dispatch({ type: 'permission/changed', canWrite: permission.canWrite });
      if (permission.canWrite) {
        dispatch({
          type: 'notice/show',
          notice: {
            id: noticeId('permission-granted'),
            tone: 'success',
            title: 'Permission granted',
            detail: 'Stilltime can now change your screen timeout.',
          },
        });
        haptics.success();
        await refresh();
      }
    } catch (error) {
      if (!mountedRef.current) return;
      dispatch({ type: 'apply/failure', notice: errorToNotice(error) });
      haptics.error();
    }
  }, [client, refresh]);

  const openWriteSettings = useCallback(async () => {
    try {
      await client.openWriteSettings();
    } catch {
      // The user backing out is not an error worth surfacing.
    }
  }, [client]);

  const openBatterySettings = useCallback(async () => {
    try {
      await client.openBatterySettings();
    } catch {
      // Some OEMs have no battery settings activity.
    }
  }, [client]);

  const toggleStayAwake = useCallback(async () => {
    const active = stateRef.current.stayAwake?.active ?? false;
    dispatch({ type: 'apply/start' });
    try {
      if (active) {
        const result = await client.stopStayAwake();
        if (!mountedRef.current) return;
        syncLocalSession(result.stayAwake);
        dispatch({
          type: 'apply/success',
          observedMs: result.snapshot.observedMs,
          appliedMs: result.snapshot.appliedMs,
          outsideDialBounds: result.snapshot.outsideDialBounds,
        });
        dispatch({ type: 'stayAwake/update', stayAwake: result.stayAwake });
        dispatch({
          type: 'notice/show',
          notice: result.skipped
            ? {
                id: noticeId('stay-awake-skipped'),
                tone: 'warning',
                title: 'Stay Awake stopped without restoring',
                detail:
                  'The timeout was changed outside Stilltime, so your current value was left alone.',
              }
            : {
                id: noticeId('stay-awake-restored'),
                tone: 'success',
                title: 'Previous timeout restored',
                detail: `The device now turns the screen off after ${formatShort(result.restoredMs ?? 0)}.`,
              },
        });
        if (result.skipped) haptics.warning();
        else haptics.success();
      } else {
        const result = await client.startStayAwake();
        if (!mountedRef.current) return;
        syncLocalSession(result.stayAwake);
        dispatch({
          type: 'apply/success',
          observedMs: result.snapshot.observedMs,
          appliedMs: result.snapshot.appliedMs,
          outsideDialBounds: result.snapshot.outsideDialBounds,
        });
        dispatch({ type: 'stayAwake/update', stayAwake: result.stayAwake });
        dispatch({
          type: 'notice/show',
          notice: {
            id: noticeId('stay-awake-started'),
            tone: 'info',
            title: 'Stay Awake is on',
            detail: 'The screen will stay on for up to 30 minutes while you use Stilltime.',
          },
        });
        haptics.light();
      }
    } catch (error) {
      if (!mountedRef.current) return;
      dispatch({ type: 'apply/failure', notice: errorToNotice(error) });
      haptics.error();
    }
  }, [client, syncLocalSession]);

  const dismissNotice = useCallback(() => {
    dispatch({ type: 'notice/dismiss' });
  }, []);

  const value = useMemo<StilltimeContextValue>(
    () => ({
      ...state,
      client,
      setDraftMs,
      beginDrag,
      endDrag,
      tickSelection,
      apply,
      requestPermission,
      openWriteSettings,
      openBatterySettings,
      toggleStayAwake,
      refresh,
      dismissNotice,
      announce,
    }),
    [
      state,
      client,
      setDraftMs,
      beginDrag,
      endDrag,
      tickSelection,
      apply,
      requestPermission,
      openWriteSettings,
      openBatterySettings,
      toggleStayAwake,
      refresh,
      dismissNotice,
      announce,
    ],
  );

  return <StilltimeContext.Provider value={value}>{children}</StilltimeContext.Provider>;
}

export function useStilltime(): StilltimeContextValue {
  const value = useContext(StilltimeContext);
  if (!value) {
    throw new Error('useStilltime must be used inside <StilltimeProvider>.');
  }
  return value;
}

function formatShort(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'the previous value';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function localToState(local: {
  startedAt: number;
  originalMs: number;
  requestedMs: number;
  appliedMs: number;
}): StayAwakeState {
  return {
    active: true,
    startedAt: local.startedAt,
    originalMs: local.originalMs,
    appliedMs: local.appliedMs,
    observedMs: null,
    drifted: false,
    remainingMs: null,
  };
}

function errorToNotice(error: unknown): Notice {
  const remedy =
    typeof error === 'object' && error !== null && 'remedy' in error
      ? String((error as { remedy: unknown }).remedy)
      : 'Try again.';
  const message =
    error instanceof Error ? error.message : 'Something went wrong while talking to Android.';
  return {
    id: noticeId('error'),
    tone: 'error',
    title: 'Could not change the timeout',
    detail: remedy.length > 0 ? remedy : message,
  };
}