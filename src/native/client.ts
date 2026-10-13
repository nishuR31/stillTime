/**
 * The injectable seam between the app and the native module.
 *
 * `nativeScreenTimeout` is the real implementation. Tests inject a fake so the
 * state machine and UI can be exercised without a device.
 */

import type {
  ApplyResult,
  PermissionSnapshot,
  PowerSnapshot,
  ScreenOffProbeResult,
  StayAwakeState,
  StopStayAwakeResult,
  TimeoutSnapshot,
} from './types';

export interface StilltimeClient {
  isNativeAvailable: boolean;
  getPermissionState(): Promise<PermissionSnapshot>;
  requestWritePermission(): Promise<PermissionSnapshot>;
  openWriteSettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
  getTimeoutSnapshot(requestedMs?: number): Promise<TimeoutSnapshot>;
  applyTimeout(requestedMs: number): Promise<ApplyResult>;
  getPowerState(): Promise<PowerSnapshot>;
  getStayAwakeState(): Promise<StayAwakeState>;
  startStayAwake(requestedMs?: number): Promise<ApplyResult>;
  stopStayAwake(): Promise<StopStayAwakeResult>;
  reconcileStayAwake(): Promise<StayAwakeState>;
  notifyWidgets(timeoutMs: number): void;
  startScreenOffProbe(
    expectedMs: number,
    restoreToMs?: number | null,
  ): Promise<ScreenOffProbeResult>;
  getScreenOffProbe(): Promise<ScreenOffProbeResult>;
  cancelScreenOffProbe(): Promise<ScreenOffProbeResult>;
}