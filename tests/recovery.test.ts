// @vitest-environment happy-dom
import { act, createElement, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import WorkspaceRecovery from '../src/components/WorkspaceRecovery';

it('offers recovery when an editor chunk disappeared after a deployment', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const MissingEditor = lazy(() =>
    Promise.reject(new TypeError('Failed to fetch dynamically imported module: old-editor.js')),
  );
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        createElement(WorkspaceRecovery, {
          children: createElement(Suspense, { children: createElement(MissingEditor) }),
        }),
      ),
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('updated while this tab');
    expect(host.querySelector('button')?.textContent).toBe('Reload Plivvi');
    expect(host.textContent).toContain('Saved documents stay in this browser');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    log.mockRestore();
    vi.unstubAllGlobals();
  }
});
