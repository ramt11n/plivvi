// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Camera from '../src/components/Camera';
import * as image from '../src/lib/image';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});
it('keeps one live video stream attached while new edge outlines render', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let current: MediaStream | null = null;
  const attach = vi.fn((value: MediaStream) => {
    current = value;
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get: () => current,
    set: attach,
  });
  const media = { getTracks: () => [{ stop: vi.fn() }] };
  const getUserMedia = vi.fn(async () => media);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: async () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({}),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(image, 'detectCorners').mockImplementation(() => [
    { x: 40, y: 30 },
    { x: 280, y: 30 },
    { x: 280, y: 210 },
    { x: 40, y: 210 },
  ]);
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(createElement(Camera, { onCapture: vi.fn(), onClose: vi.fn() })),
    );
    const video = host.querySelector('video')!;
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 640 },
      videoHeight: { configurable: true, value: 480 },
      readyState: { configurable: true, value: 2 },
    });
    await act(async () => video.dispatchEvent(new Event('loadedmetadata')));
    await act(async () => frame!(700));
    await act(async () => frame!(1400));
    expect(host.querySelector('polygon')).not.toBeNull();
    expect(host.querySelector('video')).toBe(video);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
  }
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
