// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import SupportPrompt from '../src/components/SupportPrompt';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
});
it('never interrupts an export and honors dismissal across repeated exports', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(SupportPrompt)));
  expect(host.textContent).toBe('');
  await act(async () => {
    window.dispatchEvent(new Event('plivvi:export'));
    vi.advanceTimersByTime(700);
  });
  expect(host.textContent).toContain('Help build what’s next');
  expect(host.querySelector('a')?.getAttribute('target')).toBe('_blank');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Dismiss support invitation"]')!.click(),
  );
  await act(async () => {
    window.dispatchEvent(new Event('plivvi:export'));
    vi.advanceTimersByTime(1000);
  });
  expect(host.textContent).toBe('');
  expect(localStorage.getItem('plivvi-support-dismiss')).toBeTruthy();
  await act(async () => root.unmount());
});
