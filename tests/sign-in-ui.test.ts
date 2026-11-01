// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ popup: vi.fn(), prepare: vi.fn() }));
vi.mock('../src/integrations/auth', () => ({
  accountState: () => ({ ready: true, configured: true, active: null, accounts: [] }),
  subscribeAccounts: () => () => {},
  newAccountSession: vi.fn(),
  prepareGoogleSession: mocks.prepare,
  activateAccount: vi.fn(),
  switchAccount: vi.fn(),
  signOutAccount: vi.fn(),
  authClient: vi.fn(),
  authMessage: (e: Error) => e.message,
  authDeadline: (p: Promise<unknown>) => p,
}));
vi.mock('firebase/auth', () => ({
  browserPopupRedirectResolver: 'resolver',
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  signInWithPopup: mocks.popup,
}));
import AccountDialog from '../src/components/AccountDialog';
afterEach(() => vi.unstubAllGlobals());
it('calls the prepared Google popup during the click, before yielding user activation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.prepare.mockResolvedValue({ id: 'prepared', auth: {} });
  mocks.popup.mockReturnValue(new Promise(() => {}));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(AccountDialog, { onClose() {} })));
    const google = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Continue with Google'),
    )!;
    expect(google.disabled).toBe(false);
    await act(async () => {
      google.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // No awaited configuration/SDK/iframe setup may precede signInWithPopup.
      expect(mocks.popup).toHaveBeenCalledTimes(1);
      expect(mocks.popup.mock.calls[0][2]).toBe('resolver');
    });
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
