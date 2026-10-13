import { act, renderHook, type RenderHookResult } from '@testing-library/react-native';

import { useTapSequence, type TapSequence } from './useTapSequence';

/**
 * The seven-tap gesture is invisible by design, which makes it exactly the kind
 * of thing that breaks silently: if the window logic regresses, the testing
 * screen becomes unreachable and nothing else fails.
 *
 * `renderHook` is async in @testing-library/react-native v14, same as `render`.
 */
type Hook = RenderHookResult<TapSequence, unknown>;

describe('useTapSequence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Pin the clock: the hook measures the gap between taps with Date.now().
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function setup(required = 7) {
    const onComplete = jest.fn();
    const view = await renderHook(() => useTapSequence({ required, windowMs: 2_500, onComplete }));
    return { onComplete, view };
  }

  /** One tap, `gapMs` after the previous one. `act` is async in v14. */
  async function tap(view: Hook, gapMs: number): Promise<void> {
    jest.setSystemTime(new Date(Date.now() + gapMs));
    await act(async () => {
      view.result.current?.onPress();
    });
  }

  it('stays silent for the first taps so the gesture is not discoverable', async () => {
    const { view } = await setup();

    for (let index = 0; index < 3; index += 1) await tap(view, 100);

    expect(view.result.current?.remaining).toBeNull();
    expect(view.result.current?.count).toBe(3);
  });

  it('counts down once the user is clearly part-way in', async () => {
    const { view } = await setup();

    for (let index = 0; index < 4; index += 1) await tap(view, 100);
    expect(view.result.current?.remaining).toBe(3);

    await tap(view, 100);
    expect(view.result.current?.remaining).toBe(2);
  });

  it('fires on the seventh tap and resets', async () => {
    const { onComplete, view } = await setup();

    for (let index = 0; index < 6; index += 1) await tap(view, 100);
    expect(onComplete).not.toHaveBeenCalled();

    await tap(view, 100);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(view.result.current?.count).toBe(0);
    expect(view.result.current?.remaining).toBeNull();
  });

  it('resets when the taps are too far apart to be one gesture', async () => {
    const { onComplete, view } = await setup();

    // Six taps, then a long pause, then one more.
    for (let index = 0; index < 6; index += 1) await tap(view, 100);
    await tap(view, 9_000);

    expect(onComplete).not.toHaveBeenCalled();
    expect(view.result.current?.count).toBe(1);
  });

  it('expires on its own once the window passes', async () => {
    const { view } = await setup();

    await tap(view, 0);
    await tap(view, 100);
    expect(view.result.current?.count).toBe(2);

    await act(async () => {
      jest.advanceTimersByTime(2_600);
    });

    expect(view.result.current?.count).toBe(0);
  });

  it('does not require exactly seven — it honours the option', async () => {
    const { onComplete, view } = await setup(3);

    for (let index = 0; index < 3; index += 1) await tap(view, 100);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not fire into an unmounted tree', async () => {
    const { view } = await setup();

    await tap(view, 0);
    await view.unmount();

    // The pending reset timer would otherwise warn after teardown.
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
  });
});
