// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  popup: vi.fn(),
  prepare: vi.fn(),
  credential: vi.fn(),
  exchange: vi.fn(),
  activate: vi.fn(),
}));
vi.mock('../src/integrations/googleIdentity', () => ({ requestGoogleSignIn: mocks.popup }));
vi.mock('../src/integrations/auth', () => ({
  accountState: () => ({ ready: true, configured: true, active: null, accounts: [] }),
  subscribeAccounts: () => () => {},
  newAccountSession: vi.fn(),
  prepareGoogleSession: mocks.prepare,
  activateAccount: mocks.activate,
  switchAccount: vi.fn(),
  signOutAccount: vi.fn(),
  authClient: vi.fn(),
  authMessage: (e: Error) => e.message,
  authDeadline: (p: Promise<unknown>) => p,
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    static credential(...args: unknown[]) {
      return mocks.credential(...args);
    }
  },
  signInWithCredential: mocks.exchange,
}));
import AccountDialog from '../src/components/AccountDialog';
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());
it('calls the prepared Google popup during the click, before yielding user activation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.prepare.mockResolvedValue({ id: 'prepared', auth: {}, clientId: 'public-client' });
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
      // No awaited configuration/SDK/iframe setup may precede Google's authorization window.
      expect(mocks.popup).toHaveBeenCalledTimes(1);
      expect(mocks.popup.mock.calls[0][0]).toBe('public-client');
    });
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
it('exchanges the returned Google identity token with Firebase before activating its account', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const auth = { currentUser: null },
    credential = { providerId: 'google.com' };
  mocks.prepare.mockResolvedValue({ id: 'prepared', auth, clientId: 'public-client' });
  mocks.popup.mockResolvedValue('profile-only-token');
  mocks.credential.mockReturnValue(credential);
  mocks.exchange.mockResolvedValue({ user: { uid: 'alice' } });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(AccountDialog, { onClose() {} })));
    const google = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Continue with Google'),
    )!;
    await act(async () => google.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(mocks.credential).toHaveBeenCalledWith(null, 'profile-only-token');
    expect(mocks.exchange).toHaveBeenCalledWith(auth, credential);
    expect(mocks.activate).toHaveBeenCalledWith('prepared');
    expect(host.textContent).toContain('Signed in.');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
