import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import TestingScreen from '../../app/testing';
import { StilltimeProvider } from './StilltimeProvider';
import { createMemoryStorage } from './sessionStore';
import { createFakeClient, idleProbe, type FakeClientOptions } from '../test-support/fakeNativeClient';
import type { ScreenOffProbeResult } from '../native/types';

/** Deterministic insets so padding never depends on the host device. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

async function renderTesting(options: FakeClientOptions = {}) {
  const client = createFakeClient(options);
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <StilltimeProvider
        client={client}
        storage={createMemoryStorage()}
        pollIntervalMs={1_000_000}
      >
        <TestingScreen />
      </StilltimeProvider>
    </SafeAreaProvider>,
  );
  return client;
}

function completed(overrides: Partial<ScreenOffProbeResult> = {}): ScreenOffProbeResult {
  return { ...idleProbe(), state: 'completed', ...overrides };
}

describe('TestingScreen', () => {
  it('explains the idle state before anything has been run', async () => {
    await renderTesting();

    expect(await screen.findByText('No test has been run yet')).toBeTruthy();
  });

  it('offers a quick test that writes 15s and restores the previous value', async () => {
    const client = await renderTesting({ observedMs: 300_000 });

    const button = await screen.findByLabelText('Quick test — 15s');
    expect(button).toBeTruthy();

    await act(async () => {
      fireEvent.press(button);
    });

    // 15s was written...
    expect(client.state.probeArmed).toEqual([15_000]);
    // ...and the value the device had beforehand is what gets put back.
    await waitFor(() => expect(client.state.probe.state).toBe('armed'));
    expect(client.state.probe.restoreToMs).toBe(300_000);
    // The 15s write itself went through the normal verified path first.
    expect(client.state.applied).toContain(15_000);
  });

  it('measures the current setting without changing anything', async () => {
    const client = await renderTesting({ observedMs: 600_000 });

    const button = await screen.findByLabelText('Test current setting — 10m');
    await act(async () => {
      fireEvent.press(button);
    });

    await waitFor(() => expect(client.state.probe.state).toBe('armed'));
    expect(client.state.probeArmed).toEqual([600_000]);
    // No write, so nothing to restore.
    expect(client.state.probe.restoreToMs).toBeNull();
    expect(client.state.applied).toHaveLength(0);
  });

  it('passes a measurement that matches the requested timeout', async () => {
    await renderTesting({
      observedMs: 300_000,
      probe: completed({ expectedMs: 15_000, measuredMs: 15_300, restoreToMs: 300_000, restored: true }),
    });

    expect(await screen.findByText('The device is honouring your timeout')).toBeTruthy();
    expect(await screen.findByText('15.3s')).toBeTruthy();
    expect(await screen.findByText(/5m back/)).toBeTruthy();
  });

  it('fails loudly when the screen stays on longer than asked', async () => {
    await renderTesting({
      observedMs: 300_000,
      probe: completed({ expectedMs: 15_000, measuredMs: 25_000 }),
    });

    expect(
      await screen.findByText('The screen stayed on longer than requested'),
    ).toBeTruthy();
  });

  it('reports an interrupted run as unmeasured rather than inventing a number', async () => {
    await renderTesting({
      observedMs: 300_000,
      probe: { ...idleProbe(), state: 'interrupted', measuredMs: 4_000, note: '' },
    });

    expect(await screen.findByText('Not measured — the screen came back on')).toBeTruthy();
    expect(screen.queryByText('4.0s')).toBeNull();
  });

  it('disables the tests when the permission is missing', async () => {
    await renderTesting({ observedMs: 300_000, canWrite: false });

    const button = await screen.findByLabelText('Quick test — 15s');
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(await screen.findByText('Permission required')).toBeTruthy();
  });

  it('surfaces a failure to start instead of silently doing nothing', async () => {
    const client = await renderTesting({ observedMs: 300_000, failApply: true });

    const button = await screen.findByLabelText('Quick test — 15s');
    await act(async () => {
      fireEvent.press(button);
    });

    expect(await screen.findByText('Test problem')).toBeTruthy();
    expect(client.state.probeArmed).toHaveLength(0);
  });

  it('shows a running state and lets the user cancel', async () => {
    const client = await renderTesting({
      observedMs: 300_000,
      probe: {
        ...idleProbe(),
        state: 'armed',
        expectedMs: 15_000,
        restoreToMs: 300_000,
        armedAtWallMs: Date.now(),
      },
    });

    expect(await screen.findByText('Waiting for the screen to go off')).toBeTruthy();
    expect(screen.getByLabelText('Test already running')).toBeTruthy();

    const cancel = screen.getByLabelText('Cancel test');
    await act(async () => {
      fireEvent.press(cancel);
    });

    await waitFor(() => expect(client.state.probe.state).toBe('cancelled'));
    expect(await screen.findByText('Test cancelled')).toBeTruthy();
  });
});
