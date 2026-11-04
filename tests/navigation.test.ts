// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';
import { bindNavigation } from '../src/reader/navigation';
let surface: HTMLDivElement, first: HTMLDivElement, second: HTMLDivElement, cleanup: () => void;
let change: Mock<(scale: number, center: { x: number; y: number }) => void>,
  startGesture: Mock<(center: { x: number; y: number }) => void>,
  endGesture: Mock<() => void>,
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
  change = vi.fn();
  startGesture = vi.fn();
  endGesture = vi.fn();
  cleanup = bindNavigation(surface, {
    penActive: () => pen,
    start: (center) => startGesture(center),
    change: (scale, center) => change(scale, center),
    end: () => endGesture(),
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

it('combines alternating finger events into one absolute transform across pages', () => {
  start();
  expect(startGesture).toHaveBeenCalledWith({ x: 150, y: 100 });
  pointer('pointermove', 1, 120, 130);
  pointer('pointermove', 2, 221, 130, 'touch', second);
  expect(change).not.toHaveBeenCalled();
  frame();
  expect(change).toHaveBeenLastCalledWith(1, { x: 170.5, y: 130 });
  pointer('pointermove', 1, 130, 150);
  pointer('pointermove', 2, 229, 150);
  frame();
  expect(change).toHaveBeenLastCalledWith(1, { x: 179.5, y: 150 });
});
it('reports absolute pinch in/out while moving the same anchor', () => {
  start();
  pointer('pointermove', 1, 80, 120);
  pointer('pointermove', 2, 240, 120);
  frame();
  expect(change).toHaveBeenLastCalledWith(1.6, { x: 160, y: 120 });
  pointer('pointermove', 1, 120, 150);
  pointer('pointermove', 2, 200, 150);
  frame();
  expect(change).toHaveBeenLastCalledWith(0.8, { x: 160, y: 150 });
});
it('transitions from pan into pinch and back without lifting a finger', () => {
  start();
  pointer('pointermove', 1, 100, 130);
  pointer('pointermove', 2, 200, 130);
  frame();
  expect(change).toHaveBeenLastCalledWith(1, { x: 150, y: 130 });
  pointer('pointermove', 1, 80, 140);
  pointer('pointermove', 2, 240, 140);
  frame();
  expect(change).toHaveBeenLastCalledWith(1.6, { x: 160, y: 140 });
  pointer('pointermove', 1, 110, 170);
  pointer('pointermove', 2, 210, 170);
  frame();
  expect(change).toHaveBeenLastCalledWith(1, { x: 160, y: 170 });
});
it('cancels queued navigation on Pencil contact without swallowing pen input', () => {
  start();
  pointer('pointermove', 1, 100, 130);
  pointer('pointermove', 2, 200, 130);
  const draw = vi.fn();
  first.addEventListener('pointerdown', draw);
  pointer('pointerdown', 9, 150, 150, 'pen');
  pen = true;
  frame();
  expect(draw).toHaveBeenCalledOnce();
  expect(change).not.toHaveBeenCalled();
  expect(endGesture).toHaveBeenCalledOnce();
});
it('ignores a palm, cancels incomplete gestures, and removes listeners', () => {
  pointer('pointerdown', 1, 100, 100);
  pointer('pointermove', 1, 100, 170);
  frame();
  expect(change).not.toHaveBeenCalled();
  pointer('pointerdown', 2, 200, 100);
  pointer('pointermove', 2, 200, 150);
  pointer('pointercancel', 2, 200, 150);
  frame();
  expect(change).not.toHaveBeenCalled();
  cleanup();
  start();
  pointer('pointermove', 1, 50, 100);
  frame();
  expect(change).not.toHaveBeenCalled();
});
it('flushes final finger coordinates before closing the gesture', () => {
  start();
  pointer('pointermove', 1, 100, 130);
  pointer('pointermove', 2, 200, 130);
  pointer('pointerup', 2, 210, 140);
  expect(change).toHaveBeenCalledOnce();
  expect(endGesture).toHaveBeenCalledOnce();
  frame();
  expect(change).toHaveBeenCalledOnce();
});
