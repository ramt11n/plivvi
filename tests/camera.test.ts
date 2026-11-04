// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Camera from '../src/components/Camera';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});
it('offers enumerated cameras, requests the exact selection, and stops released streams', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    writable: true,
    value: null,
  });
  const stop = vi.fn(),
    getUserMedia = vi.fn(async (_constraints: MediaStreamConstraints) => ({
      getTracks: () => [{ stop }],
    }));
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: async () => [
        { kind: 'videoinput', deviceId: 'usb-rear', label: 'USB document camera' },
      ],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(createElement(Camera, { onCapture: vi.fn(), onClose: vi.fn() })),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(getUserMedia.mock.calls[0][0]).toMatchObject({
    audio: false,
    video: { facingMode: { ideal: 'environment' } },
  });
  const select = host.querySelector('select')!;
  expect(select.textContent).toContain('USB document camera');
  await act(async () => {
    select.value = 'usb-rear';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(getUserMedia.mock.calls.at(-1)![0]).toMatchObject({
    audio: false,
    video: { deviceId: { exact: 'usb-rear' } },
  });
  expect(stop).toHaveBeenCalled();
  const before = stop.mock.calls.length;
  await act(async () => root.unmount());
  expect(stop.mock.calls.length).toBeGreaterThan(before);
});
