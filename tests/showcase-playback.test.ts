// @vitest-environment happy-dom
import { act, createElement, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useShowcasePlayback } from '../src/components/useShowcasePlayback';

it('advances at five seconds, retains time while paused, and resets on a manual slide change', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  function Harness({ enabled, reset = 0 }: { enabled: boolean; reset?: number }) {
    const [slide, setSlide] = useState(0);
    const progress = useRef<HTMLElement>(null);
    useShowcasePlayback(enabled, `${slide}:${reset}`, progress, () => setSlide((s) => s + 1));
    return createElement(
      'div',
      null,
      createElement('output', null, slide),
      createElement('i', { ref: progress }),
    );
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = (enabled: boolean, reset = 0) =>
    act(async () => root.render(createElement(Harness, { enabled, reset })));
  const advance = (ms: number) => act(async () => vi.advanceTimersByTime(ms));
  try {
    await render(true);
    await advance(3000);
    expect(host.querySelector('output')!.textContent).toBe('0');
    expect(parseFloat(host.querySelector('i')!.style.transform.slice(7))).toBeCloseTo(0.6, 1);
    await render(false);
    await advance(8000);
    expect(host.querySelector('output')!.textContent).toBe('0');
    await render(true);
    await advance(2020);
    expect(host.querySelector('output')!.textContent).toBe('1');
    await advance(3000);
    await render(true, 1);
    await advance(3000);
    expect(host.querySelector('output')!.textContent).toBe('1');
    await advance(2020);
    expect(host.querySelector('output')!.textContent).toBe('2');
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
