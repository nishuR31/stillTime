import { act, fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import DialScreen from '../../app/index';
import { StilltimeProvider } from './StilltimeProvider';
import { createMemoryStorage } from './sessionStore';
import { createFakeClient, type FakeClient, type FakeClientOptions } from '../test-support/fakeNativeClient';

/** Deterministic insets so padding never depends on the host device. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

/** `render` is async in @testing-library/react-native v14. */
async function renderDial(options: FakeClientOptions = {}) {
  const client = createFakeClient(options);
  const view: RenderResult = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <StilltimeProvider client={client} storage={createMemoryStorage()} pollIntervalMs={1_000_000}>
        <DialScreen />
      </StilltimeProvider>
    </SafeAreaProvider>,
  );
  return { client, view };
}

async function renderWithBrokenNative(): Promise<FakeClient> {
  const client = createFakeClient();
  const fail = async (): Promise<never> => {
    throw new Error('Native module "StilltimeTimeout" is unavailable.');
  };

  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <StilltimeProvider
        client={{
          ...client,
          isNativeAvailable: false,
          getPermissionState: fail,
          getTimeoutSnapshot: fail,
          getPowerState: fail,
          getStayAwakeState: fail,
        }}
        storage={createMemoryStorage()}
        pollIntervalMs={1_000_000}
      >
        <DialScreen />
      </StilltimeProvider>
    </SafeAreaProvider>,
  );

  return client;
}

describe('DialScreen', () => {
  it('renders the app title and a ready status when permission is granted', async () => {
    await renderDial();

    expect(await screen.findByText('Stilltime')).toBeTruthy();
    expect(await screen.findByText('Ready')).toBeTruthy();
  });

  it('shows the permission card when the grant is missing', async () => {
    await renderDial({ canWrite: false });

    expect(await screen.findByText('Stilltime needs permission')).toBeTruthy();
    expect(screen.getByLabelText('Grant permission')).toBeTruthy();
    expect(screen.getByText('Permission needed')).toBeTruthy();
  });

  it('shows the observed device value on the dial', async () => {
    await renderDial({ observedMs: 300_000 });

    expect(await screen.findByText('5m')).toBeTruthy();
  });

  it('enables applying once the draft matches the device value', async () => {
    await renderDial({ observedMs: 300_000 });

    expect(await screen.findByText('Already set')).toBeTruthy();
    expect(screen.getByLabelText('Already set').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('surfaces a fatal error instead of a blank screen when native is missing', async () => {
    await renderWithBrokenNative();

    expect(await screen.findByText('Stilltime could not start')).toBeTruthy();
    expect(screen.getByText(/does not run in Expo Go/)).toBeTruthy();
  });

  it('grants permission when the user taps the permission card', async () => {
    const { client } = await renderDial({ canWrite: false });

    const button = await screen.findByLabelText('Grant permission');
    await act(async () => {
      fireEvent.press(button);
    });

    await waitFor(() => expect(client.state.canWrite).toBe(true));
    expect(await screen.findByText('Ready')).toBeTruthy();
  });

  it('shows every preset', async () => {
    await renderDial();
    await screen.findByText('Ready');

    for (const label of ['15s', '30s', '1m', '2m', '5m', '10m', '15m', '30m']) {
      expect(screen.getAllByLabelText(`Set timeout to ${label}`)).toHaveLength(1);
    }
  });

  it('always renders the footer project link', async () => {
    await renderDial();

    expect(await screen.findByText('https://github.com/nishur31')).toBeTruthy();
  });

  it('surfaces the Stay Awake control with a clear explanation', async () => {
    await renderDial();

    expect(await screen.findByLabelText('Start Stay Awake')).toBeTruthy();
    expect(
      screen.getByText(/never runs a background service or holds a wake lock/i),
    ).toBeTruthy();
  });

  it('links to the diagnostics screen', async () => {
    await renderDial();

    expect(await screen.findByLabelText('Power & permissions')).toBeTruthy();
  });
});