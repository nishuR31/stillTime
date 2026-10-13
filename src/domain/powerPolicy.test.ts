import { manufacturerNote, summarisePower, type PowerSnapshot } from './powerPolicy';

function snapshot(overrides: Partial<PowerSnapshot> = {}): PowerSnapshot {
  return {
    powerSaveMode: false,
    deviceIdleMode: false,
    ignoringBatteryOptimizations: false,
    sdkInt: 36,
    manufacturer: 'Google',
    ...overrides,
  };
}

describe('summarisePower', () => {
  it('reports no impact on a clean device', () => {
    const guidance = summarisePower(snapshot());
    expect(guidance.impact).toBe('none');
    expect(guidance.suggestBatterySettings).toBe(false);
  });

  it('treats Doze as blocking', () => {
    const guidance = summarisePower(snapshot({ deviceIdleMode: true }));
    expect(guidance.impact).toBe('blocked');
    expect(guidance.suggestBatterySettings).toBe(true);
  });

  it('prefers the Doze message over the Battery Saver one', () => {
    const guidance = summarisePower(
      snapshot({ deviceIdleMode: true, powerSaveMode: true }),
    );
    expect(guidance.impact).toBe('blocked');
  });

  it('softens Battery Saver when the app is exempt', () => {
    const guidance = summarisePower(
      snapshot({ powerSaveMode: true, ignoringBatteryOptimizations: true }),
    );
    expect(guidance.impact).toBe('noticeable');
    expect(guidance.suggestBatterySettings).toBe(false);
  });

  it('suggests battery settings when Battery Saver may defer writes', () => {
    const guidance = summarisePower(snapshot({ powerSaveMode: true }));
    expect(guidance.impact).toBe('noticeable');
    expect(guidance.suggestBatterySettings).toBe(true);
  });

  it('never claims a cause it cannot observe', () => {
    for (const state of [
      snapshot(),
      snapshot({ powerSaveMode: true }),
      snapshot({ deviceIdleMode: true }),
    ]) {
      const { detail } = summarisePower(state);
      expect(detail).not.toMatch(/battery saver (caused|blocked) this/i);
    }
  });
});

describe('manufacturerNote', () => {
  it('returns null for an unknown vendor', () => {
    expect(manufacturerNote('Google')).toBeNull();
    expect(manufacturerNote('')).toBeNull();
  });

  it.each(['Xiaomi', 'samsung', 'HUAWEI', 'OnePlus', 'vivo'])(
    'has a note for %s',
    (vendor) => {
      expect(manufacturerNote(vendor)).not.toBeNull();
    },
  );
});