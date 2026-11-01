import { integrationConfig } from './config';
import type { Auth, User } from 'firebase/auth';

export type Account = { id: string; uid: string; name: string; email: string; verified: boolean };
export type AccountState = {
  ready: boolean;
  configured: boolean;
  accounts: Account[];
  active: Account | null;
  error?: string;
};
export const account = (user: User, id = 'primary'): Account => ({
  id,
  uid: user.uid,
  name: user.displayName || user.email?.split('@')[0] || 'Your account',
  email: user.email ?? '',
  verified: user.emailVerified,
});
const clients = new Map<string, Promise<Auth>>();
const observed = new Map<string, () => void>();
const listeners = new Set<(state: AccountState) => void>();
const legacySelection = readSession('pocket-active-auth', '__unset') === '__unset';
let activeId = readSession('pocket-active-auth', ''),
  slots: string[] = readSlots(),
  state: AccountState = { ready: false, configured: false, accounts: [], active: null },
  startup: Promise<void> | undefined;
function readSession(key: string, fallback: string) {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function readSlots(): string[] {
  try {
    const value = JSON.parse(readSession('pocket-auth-slots', '["primary"]'));
    return Array.isArray(value)
      ? value
          .filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id))
          .slice(0, 10)
      : ['primary'];
  } catch {
    return ['primary'];
  }
}
function persist() {
  try {
    sessionStorage.setItem('pocket-auth-slots', JSON.stringify(slots));
    sessionStorage.setItem('pocket-active-auth', activeId);
  } catch {}
}
function publish() {
  state = { ...state, active: state.accounts.find((a) => a.id === activeId) ?? null };
  for (const listener of listeners) listener(state);
}
export function accountState() {
  return state;
}
export function subscribeAccounts(listener: (state: AccountState) => void) {
  listeners.add(listener);
  listener(state);
  initializeAccounts();
  return () => {
    listeners.delete(listener);
  };
}
export async function authClient(id = activeId || 'primary') {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw Error('Invalid account session.');
  if (!clients.has(id)) {
    const promise = (async () => {
      const config = await integrationConfig();
      if (
        !config.firebase?.apiKey ||
        !config.firebase.authDomain ||
        !config.firebase.projectId ||
        !config.firebase.appId
      )
        throw Error(
          'Online accounts are not connected on this deployment yet. Your guest workspace is available.',
        );
      const { initializeApp, getApps } = await import('firebase/app');
      const { initializeAuth, getAuth, browserSessionPersistence } = await import('firebase/auth');
      const name = id === 'primary' ? 'pocket' : `pocket-session-${id}`;
      const app = getApps().find((a) => a.name === name) ?? initializeApp(config.firebase, name);
      let auth: Auth;
      try {
        // Defer the cross-origin OAuth iframe until the user actually chooses Google.
        auth = initializeAuth(app, { persistence: browserSessionPersistence });
      } catch (error) {
        if ((error as { code?: string }).code !== 'auth/already-initialized') throw error;
        auth = getAuth(app);
      }
      await authDeadline(auth.authStateReady(), 15000);
      return auth;
    })().catch((error) => {
      clients.delete(id);
      throw error;
    });
    clients.set(id, promise);
  }
  return clients.get(id)!;
}
async function observe(id: string) {
  const auth = await authClient(id);
  if (observed.has(id)) return;
  const { onAuthStateChanged } = await import('firebase/auth');
  observed.set(
    id,
    onAuthStateChanged(auth, (user) => {
      const accounts = state.accounts.filter((a) => a.id !== id);
      if (user) accounts.push(account(user, id));
      state = { ...state, accounts };
      publish();
    }),
  );
  if (auth.currentUser) {
    state = {
      ...state,
      accounts: [...state.accounts.filter((a) => a.id !== id), account(auth.currentUser, id)],
    };
    publish();
  }
}
export function initializeAccounts() {
  return (startup ??= (async () => {
    try {
      const c = await integrationConfig();
      const configured = !!(
        c.firebase?.apiKey &&
        c.firebase.authDomain &&
        c.firebase.projectId &&
        c.firebase.appId
      );
      state = { ...state, configured };
      if (configured) {
        await Promise.all(slots.map(observe));
        // Restore the previous single-account session during the upgrade.
        if (
          legacySelection &&
          !activeId &&
          state.accounts.length === 1 &&
          state.accounts[0].id === 'primary'
        )
          activeId = 'primary';
        persist();
      }
    } catch (error) {
      state = { ...state, error: authMessage(error) };
    }
    state = { ...state, ready: true };
    publish();
  })());
}
export async function newAccountSession() {
  if (state.accounts.length >= 10)
    throw Error(
      'Sign out of an account before adding another. Up to 10 accounts can stay signed in in this tab.',
    );
  const id = crypto.randomUUID();
  return { id, auth: await authClient(id) };
}
export async function activateAccount(id: string) {
  const auth = await authClient(id);
  if (!auth.currentUser) throw Error('Sign in again to open this account.');
  const duplicate = state.accounts.find((a) => a.uid === auth.currentUser!.uid && a.id !== id);
  if (duplicate) {
    await (await import('firebase/auth')).signOut(auth);
    activeId = duplicate.id;
  } else {
    if (!slots.includes(id)) slots.push(id);
    await observe(id);
    state = {
      ...state,
      accounts: [...state.accounts.filter((a) => a.id !== id), account(auth.currentUser, id)],
    };
    activeId = id;
  }
  persist();
  publish();
}
export function switchAccount(id: string | null) {
  if (id && !state.accounts.some((a) => a.id === id))
    throw Error('That account is no longer signed in.');
  activeId = id ?? '';
  persist();
  publish();
}
export async function signOutAccount(id: string) {
  const auth = await authClient(id);
  await (await import('firebase/auth')).signOut(auth);
  observed.get(id)?.();
  observed.delete(id);
  slots = slots.filter((s) => s !== id);
  if (activeId === id) activeId = '';
  state = { ...state, accounts: state.accounts.filter((a) => a.id !== id) };
  persist();
  publish();
}
export function authMessage(error: unknown) {
  const code = (error as any)?.code;
  return (
    (
      {
        'auth/invalid-credential':
          'The email or password was not accepted. Check both and try again.',
        'auth/email-already-in-use':
          'An account already uses this email. Try signing in or resetting its password.',
        'auth/weak-password': 'Choose a longer password.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/popup-closed-by-user': 'The sign-in window was closed. You can try again.',
        'auth/cancelled-popup-request':
          'A different sign-in window is already open. Finish it first.',
        'auth/popup-blocked':
          'Your browser blocked the sign-in window. Allow it for this site and try again.',
        'auth/unauthorized-domain':
          'This website address has not been enabled for sign-in by the owner yet. Continue as a guest.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled on this deployment yet.',
        'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
        'auth/network-request-failed':
          'Sign-in needs an internet connection. Your local document tools still work.',
      } as Record<string, string>
    )[code] ?? (error instanceof Error ? error.message : 'Sign-in could not be completed.')
  );
}

export async function authDeadline<T>(pending: Promise<T>, milliseconds = 30000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          Error(
            'The sign-in service took too long to respond. Check your connection and try again. Your local workspace is still available.',
          ),
        ),
      milliseconds,
    );
  });
  try {
    return await Promise.race([pending, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
