/**
 * Durable mirror of the Stay Awake session.
 *
 * The Kotlin module owns the authoritative session (it must, because the
 * widget can run without the RN process). This store exists so the UI can
 * render instantly on the first frame and so tests have a deterministic
 * surface. It is always reconciled against the native module on foreground.
 */

export const STORAGE_KEY = 'stilltime.session.v1';

export interface PersistedStayAwake {
  startedAt: number;
  originalMs: number;
  requestedMs: number;
  appliedMs: number;
}

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Minimal AsyncStorage-compatible surface, kept local to avoid a dependency. */
export function createMemoryStorage(): SessionStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

export function parseSession(raw: string | null): PersistedStayAwake | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    const keys = ['startedAt', 'originalMs', 'requestedMs', 'appliedMs'] as const;
    for (const key of keys) {
      const value = candidate[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null;
      }
    }
    return {
      startedAt: candidate.startedAt as number,
      originalMs: candidate.originalMs as number,
      requestedMs: candidate.requestedMs as number,
      appliedMs: candidate.appliedMs as number,
    };
  } catch {
    return null;
  }
}

export function serialiseSession(session: PersistedStayAwake | null): string | null {
  if (!session) return null;
  return JSON.stringify(session);
}

export function readSession(storage: SessionStorage): PersistedStayAwake | null {
  return parseSession(storage.getItem(STORAGE_KEY));
}

export function writeSession(
  storage: SessionStorage,
  session: PersistedStayAwake | null,
): void {
  const serialised = serialiseSession(session);
  if (serialised === null) {
    storage.removeItem(STORAGE_KEY);
  } else {
    storage.setItem(STORAGE_KEY, serialised);
  }
}

export function clearSession(storage: SessionStorage): void {
  storage.removeItem(STORAGE_KEY);
}