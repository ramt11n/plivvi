// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, Profiler } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import PDFPage from '../src/reader/PDFPage';
import type { Mark, PenActivity, ReaderTool } from '../src/reader/types';
vi.mock('../src/lib/client', () => ({
  rpc: async (op: string) =>
    op === 'reader-text' ? { chars: [], text: '' } : { data: new Uint8Array() },
}));
let root: Root, host: HTMLDivElement, scroll: ReturnType<typeof vi.fn>;
const ctx = {
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.assign(SVGElement.prototype, {
    setPointerCapture() {},
    hasPointerCapture() {
      return false;
    },
    releasePointerCapture() {},
  });
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 600, 800),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  host = document.createElement('div');
  host.className = 'reader-scroll';
  document.body.append(host);
  scroll = vi.fn();
  host.scrollBy = scroll as typeof host.scrollBy;
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount(
  touchInk = false,
  penActivity: PenActivity = { pointer: null, until: 0 },
  tool: ReaderTool = 'pen',
) {
  const onMark = vi.fn(),
    onRender = vi.fn();
  await act(async () =>
    root.render(
      createElement(
        Profiler,
        { id: 'page', onRender },
        createElement(PDFPage, {
          session: 'test',
          index: 0,
          width: 600,
          height: 800,
          displayWidth: 600,
          marks: [],
          tool,
          color: '#3659e3',
          size: 3,
          touchInk,
          penStyle: 'fountain',
          penActivity,
          selected: null,
          onSelect: () => {},
          onMark,
          onErase: () => {},
          onUpdate: () => {},
          onVisible: () => {},
          onZoom: () => {},
        }),
      ),
    ),
  );
  return { svg: host.querySelector('svg')!, onMark, onRender };
}
function pointer(svg: SVGSVGElement, type: string, id: number, x: number, y: number, kind = 'pen') {
  svg.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId: id,
      pointerType: kind,
      clientX: x,
      clientY: y,
      pressure: 0.65,
      buttons: type === 'pointerup' ? 0 : 1,
    }),
  );
}
describe('pen and palm interaction regressions', () => {
  it('releases palm filtering after placing a text box with the Pencil', async () => {
    const penActivity: PenActivity = { pointer: null, until: 0 };
    const { svg, onMark } = await mount(false, penActivity, 'text');
    await act(async () => {
      pointer(svg, 'pointerdown', 2, 100, 100);
      pointer(svg, 'pointerup', 2, 100, 100);
    });
    expect(onMark).toHaveBeenCalledTimes(1);
    expect(penActivity.pointer).toBeNull();
  });
  it('does not resume an old palm gesture when a stroke on another page finishes', async () => {
    const penActivity: PenActivity = { pointer: null, until: 0 };
    const { svg } = await mount(false, penActivity);
    await act(async () => {
      pointer(svg, 'pointerdown', 1, 50, 50, 'touch');
      penActivity.pointer = 99;
      pointer(svg, 'pointermove', 1, 50, 100, 'touch');
      penActivity.pointer = null;
      pointer(svg, 'pointermove', 1, 50, 200, 'touch');
    });
    expect(scroll).not.toHaveBeenCalled();
  });
  it('stops an existing finger from scrolling as soon as the Pencil touches the page', async () => {
    const { svg, onMark } = await mount();
    await act(async () => {
      pointer(svg, 'pointerdown', 1, 50, 50, 'touch');
      pointer(svg, 'pointerdown', 2, 100, 100);
      pointer(svg, 'pointermove', 1, 50, 180, 'touch');
      pointer(svg, 'pointermove', 2, 160, 180);
      pointer(svg, 'pointerup', 2, 175, 190);
    });
    expect(scroll).not.toHaveBeenCalled();
    expect(onMark).toHaveBeenCalledTimes(1);
    const ink = onMark.mock.calls[0][0] as Mark;
    expect(ink.points.at(-1)?.x).toBeCloseTo(175 / 600);
    expect(ink.points.at(-1)?.y).toBeCloseTo(190 / 800);
  });
  it('retains visible ink on pointercancel/lost capture and accepts the next stroke', async () => {
    const { svg, onMark } = await mount();
    await act(async () => {
      pointer(svg, 'pointerdown', 2, 100, 100);
      pointer(svg, 'pointermove', 2, 180, 180);
      pointer(svg, 'pointercancel', 2, 0, 0);
      pointer(svg, 'lostpointercapture', 2, 0, 0);
      pointer(svg, 'pointerdown', 3, 200, 200);
      pointer(svg, 'pointermove', 3, 260, 260);
      pointer(svg, 'lostpointercapture', 3, 0, 0);
    });
    expect(onMark).toHaveBeenCalledTimes(2);
    expect(onMark.mock.calls[0][0].points.at(-1).x).toBeCloseTo(0.3);
    expect(onMark.mock.calls[1][0].points.at(-1).x).toBeCloseTo(260 / 600);
  });
  it('rejects palm navigation on another page while a pen is active', async () => {
    const { svg, onMark } = await mount(false, { pointer: 99, until: 0 });
    await act(async () => {
      pointer(svg, 'pointerdown', 1, 50, 50, 'touch');
      pointer(svg, 'pointermove', 1, 50, 200, 'touch');
    });
    expect(scroll).not.toHaveBeenCalled();
    expect(onMark).not.toHaveBeenCalled();
  });
  it('does not create a palm dot when Pencil takes over from finger ink', async () => {
    const { svg, onMark } = await mount(true);
    await act(async () => {
      pointer(svg, 'pointerdown', 1, 50, 50, 'touch');
      pointer(svg, 'pointerdown', 2, 100, 100);
      pointer(svg, 'pointermove', 2, 150, 150);
      pointer(svg, 'pointerup', 2, 150, 150);
    });
    expect(onMark).toHaveBeenCalledTimes(1);
    expect(onMark.mock.calls[0][0].points[0].x).toBeCloseTo(1 / 6);
  });
  it('draws a thousand pen samples without a React commit for each movement', async () => {
    const { svg, onRender, onMark } = await mount();
    await act(async () => pointer(svg, 'pointerdown', 2, 10, 10));
    const before = onRender.mock.calls.length;
    await act(async () => {
      for (let i = 0; i < 1000; i++) pointer(svg, 'pointermove', 2, 11 + i * 0.5, 20 + (i % 80));
    });
    expect(onRender.mock.calls.length - before).toBeLessThanOrEqual(1);
    await act(async () => pointer(svg, 'pointerup', 2, 511, 100));
    expect(onMark.mock.calls[0][0].points.length).toBeGreaterThan(900);
  });
});
