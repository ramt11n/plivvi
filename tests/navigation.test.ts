// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';
import { bindNavigation } from '../src/reader/navigation';
let surface: HTMLDivElement, first: HTMLDivElement, second: HTMLDivElement, cleanup: () => void;
let zoom: Mock<(ratio: number, anchor: { x: number; y: number }) => void>,
  pan: Mock<(x: number, y: number) => void>,
  pen: boolean;
let frames: Map<number, FrameRequestCallback>, sequence: number;
beforeEach(() => {
  frames = new Map();
  sequence = 0;
  pen = false;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.set(++sequence, fn);
    return sequence;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  surface = document.createElement('div');
  first = document.createElement('div');
  second = document.createElement('div');
  surface.append(first, second);
  document.body.append(surface);
  Object.assign(surface, {
    setPointerCapture() {},
    hasPointerCapture: () => false,
    releasePointerCapture() {},
  });
  pan = vi.fn();
  zoom = vi.fn();
  Object.assign(surface, { scrollBy: pan });
  cleanup = bindNavigation(surface, {
    penActive: () => pen,
    zoom: (ratio, anchor) => zoom(ratio, anchor),
  });
});
afterEach(() => {
  cleanup();
  surface.remove();
  vi.unstubAllGlobals();
});
function pointer(
  type: string,
  id: number,
  x: number,
  y: number,
  kind = 'touch',
  target: Element = first,
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: kind,
      pointerId: id,
      clientX: x,
      clientY: y,
    }),
  );
}
function frame() {
  const batch = [...frames.values()];
  frames.clear();
  batch.forEach((fn) => fn(0));
}
function start() {
  pointer('pointerdown', 1, 100, 100);
  pointer('pointerdown', 2, 200, 100, 'touch', second);
}
it('pans across page boundaries without zooming from alternating finger events or small distance jitter', () => {
  start();
  pointer('pointermove', 1, 120, 130);
  pointer('pointermove', 2, 221, 130, 'touch', second);
  expect(pan).not.toHaveBeenCalled();
  frame();
  expect(pan).toHaveBeenCalledWith(-20.5, -30);
  pointer('pointermove', 1, 130, 150);
  pointer('pointermove', 2, 229, 150, 'touch', second);
  frame();
  expect(zoom).not.toHaveBeenCalled();
});
it('pinches in and out around the original midpoint without also scrolling', () => {
  start();
  pointer('pointermove', 1, 80, 100);
  pointer('pointermove', 2, 220, 100);
  frame();
  expect(zoom).toHaveBeenLastCalledWith(1.4, { x: 150, y: 100 });
  pointer('pointermove', 1, 110, 100);
  pointer('pointermove', 2, 190, 100);
  frame();
  expect(zoom.mock.calls[1][0]).toBeCloseTo(80 / 140);
  expect(pan).not.toHaveBeenCalled();
});
it('keeps gesture intent locked, then permits a different gesture after lifting a finger', () => {
  start();
  pointer('pointermove', 1, 100, 120);
  pointer('pointermove', 2, 200, 120);
  frame();
  pointer('pointermove', 1, 60, 120);
  pointer('pointermove', 2, 240, 120);
  frame();
  expect(zoom).not.toHaveBeenCalled();
  pointer('pointerup', 2, 240, 120);
  pointer('pointerdown', 2, 200, 120);
  pan.mockClear();
  pointer('pointermove', 1, 40, 120);
  pointer('pointermove', 2, 220, 120);
  frame();
  expect(zoom).toHaveBeenCalled();
  expect(pan).not.toHaveBeenCalled();
});
it('cancels queued navigation on Pencil contact and does not swallow the pen event', () => {
  start();
  pointer('pointermove', 1, 100, 130);
  pointer('pointermove', 2, 200, 130);
  const draw = vi.fn();
  first.addEventListener('pointerdown', draw);
  pointer('pointerdown', 9, 150, 150, 'pen');
  pen = true;
  frame();
  expect(draw).toHaveBeenCalledOnce();
  expect(pan).not.toHaveBeenCalled();
  expect(zoom).not.toHaveBeenCalled();
});
it('discards cancelled and single-finger gestures and removes listeners on teardown', () => {
  pointer('pointerdown', 1, 100, 100);
  pointer('pointermove', 1, 100, 170);
  frame();
  expect(pan).not.toHaveBeenCalled();
  pointer('pointerdown', 2, 200, 100);
  pointer('pointermove', 2, 200, 150);
  pointer('pointercancel', 2, 200, 150);
  frame();
  expect(pan).not.toHaveBeenCalled();
  expect(zoom).not.toHaveBeenCalled();
  cleanup();
  start();
  pointer('pointermove', 1, 50, 100);
  frame();
  expect(zoom).not.toHaveBeenCalled();
});
