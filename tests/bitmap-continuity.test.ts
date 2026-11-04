// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
const rendering = vi.hoisted(() => vi.fn());
vi.mock('../src/reader/renderQueue', () => ({ renderPage: rendering }));
vi.mock('../src/lib/client', () => ({ rpc: async () => ({ chars: [], text: '' }) }));
import PDFPage from '../src/reader/PDFPage';
it('keeps the previous decoded page while a new zoom bitmap is rendering', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  const observerCallbacks: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        observerCallbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode() {
        return Promise.resolve();
      }
    },
  );
  vi.spyOn(URL, 'createObjectURL')
    .mockReturnValueOnce('blob:first')
    .mockReturnValueOnce('blob:zoom');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  let finishZoom!: (r: { data: Uint8Array }) => void;
  rendering.mockResolvedValueOnce({ data: new Uint8Array([1]) }).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishZoom = resolve;
      }),
  );
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const props: any = {
    session: 'book',
    index: 0,
    width: 600,
    height: 800,
    displayWidth: 600,
    marks: [],
    tool: 'select',
    color: '#000',
    size: 3,
    touchInk: false,
    penStyle: 'fountain',
    selected: null,
    onSelect: vi.fn(),
    onMark: vi.fn(),
    onErase: vi.fn(),
    onUpdate: vi.fn(),
    onVisible: vi.fn(),
  };
  try {
    await act(async () => root.render(createElement(PDFPage, props)));
    await act(async () => observerCallbacks[0]([{ isIntersecting: true }] as any, {} as any));
    expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:first');
    await act(async () => root.render(createElement(PDFPage, { ...props, displayWidth: 900 })));
    await act(async () => vi.advanceTimersByTime(221));
    expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:first');
    await act(async () => finishZoom({ data: new Uint8Array([2]) }));
    expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:zoom');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
