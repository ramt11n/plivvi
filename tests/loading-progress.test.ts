// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import LoadingProgress from '../src/components/LoadingProgress';
it('uses indeterminate progress when no measurement exists, then shows measured page progress', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'),
    root = createRoot(host);
  try {
    await act(async () => root.render(createElement(LoadingProgress, { label: 'Loading editor' })));
    expect(host.querySelector('progress')!.hasAttribute('value')).toBe(false);
    expect(host.textContent).not.toContain('%');
    await act(async () =>
      root.render(createElement(LoadingProgress, { label: 'Creating pages', value: 50 })),
    );
    expect(host.querySelector('progress')!.value).toBe(50);
    expect(host.textContent).toContain('50%');
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
