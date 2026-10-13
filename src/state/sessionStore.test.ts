import {
  clearSession,
  createMemoryStorage,
  parseSession,
  readSession,
  serialiseSession,
  STORAGE_KEY,
  writeSession,
} from './sessionStore';

const VALID = {
  startedAt: 1_700_000_000_000,
  originalMs: 300_000,
  requestedMs: 1_800_000,
  appliedMs: 1_800_000,
};

describe('parseSession', () => {
  it('parses a well-formed payload', () => {
    expect(parseSession(JSON.stringify(VALID))).toEqual(VALID);
  });

  it('rejects malformed JSON', () => {
    expect(parseSession('{')).toBeNull();
    expect(parseSession('')).toBeNull();
  });

  it('rejects a null payload', () => {
    expect(parseSession(null)).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(parseSession('"nope"')).toBeNull();
    expect(parseSession('42')).toBeNull();
  });

  it('rejects a payload with a missing field', () => {
    expect(parseSession(JSON.stringify({ ...VALID, appliedMs: undefined }))).toBeNull();
  });

  it('rejects non-positive or non-finite numbers', () => {
    expect(parseSession(JSON.stringify({ ...VALID, appliedMs: 0 }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...VALID, appliedMs: -1 }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...VALID, startedAt: 'soon' }))).toBeNull();
  });
});

describe('round trip', () => {
  it('serialises and parses symmetrically', () => {
    expect(parseSession(serialiseSession(VALID))).toEqual(VALID);
  });

  it('serialises null as null', () => {
    expect(serialiseSession(null)).toBeNull();
  });
});

describe('storage', () => {
  it('writes and reads a session', () => {
    const storage = createMemoryStorage();
    writeSession(storage, VALID);
    expect(readSession(storage)).toEqual(VALID);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('removes the key when the session is null', () => {
    const storage = createMemoryStorage();
    writeSession(storage, VALID);
    writeSession(storage, null);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears explicitly', () => {
    const storage = createMemoryStorage();
    writeSession(storage, VALID);
    clearSession(storage);
    expect(readSession(storage)).toBeNull();
  });

  it('ignores a corrupted stored value', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEY, 'not json');
    expect(readSession(storage)).toBeNull();
  });
});