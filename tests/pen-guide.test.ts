// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import PenGuide from '../src/reader/PenGuide';
it('focuses the guide action, closes on Escape, and restores prior focus', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const original = document.createElement('button'),
    host = document.createElement('div');
  document.body.append(original, host);
  original.focus();
  const onClose = vi.fn(),
    root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PenGuide, { onClose })));
    expect(document.activeElement?.textContent).toContain('Let’s write');
    expect(host.textContent).toContain('move and zoom together');
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    expect(document.activeElement).toBe(original);
    host.remove();
    original.remove();
    vi.unstubAllGlobals();
  }
});
