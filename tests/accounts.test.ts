import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  apps: new Map<string, any>(),
  auth: new Map<string, any>(),
  session: new Map<string, string>(),
}));
vi.mock('firebase/app', () => ({
  getApps: () => [...mock.apps.values()],
  initializeApp: (_config: unknown, name: string) => {
    const app = { name };
    mock.apps.set(name, app);
    return app;
  },
}));
vi.mock('firebase/auth', () => ({
  browserSessionPersistence: 'session',
  browserPopupRedirectResolver: 'popup-resolver',
  setPersistence: async () => {},
  initializeAuth: (app: any, options: unknown) => {
    if (!mock.auth.has(app.name))
      mock.auth.set(app.name, {
        currentUser: null,
        authStateReady: async () => {},
        listeners: new Set<Function>(),
        options,
      });
    return mock.auth.get(app.name);
  },
  getAuth: (app: any) => {
    if (!mock.auth.has(app.name))
      mock.auth.set(app.name, {
        currentUser: null,
        authStateReady: async () => {},
        listeners: new Set<Function>(),
      });
    return mock.auth.get(app.name);
  },
  onAuthStateChanged: (auth: any, fn: Function) => {
    auth.listeners.add(fn);
    fn(auth.currentUser);
    return () => auth.listeners.delete(fn);
  },
  signOut: async (auth: any) => {
    auth.currentUser = null;
    for (const fn of auth.listeners) fn(null);
  },
}));
const user = (uid: string) => ({
  uid,
  displayName: uid.toUpperCase(),
  email: `${uid}@example.test`,
  emailVerified: true,
});
beforeEach(() => {
  vi.resetModules();
  mock.apps.clear();
  mock.auth.clear();
  mock.session.clear();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => mock.session.get(k) ?? null,
    setItem: (k: string, v: string) => mock.session.set(k, v),
  });
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({
      firebase: {
        apiKey: 'public-test-key',
        authDomain: 'example.test',
        projectId: 'test-project',
        appId: 'test-app',
      },
    }),
  }));
});
describe('account session management', () => {
  it('warms one Google session before the tap without loading a popup iframe for ordinary sessions', async () => {
    const auth = await import('../src/integrations/auth');
    await auth.initializeAccounts();
    const ordinary = await auth.newAccountSession();
    expect((ordinary.auth as any).options.popupRedirectResolver).toBeUndefined();
    const [first, second] = await Promise.all([
      auth.prepareGoogleSession(),
      auth.prepareGoogleSession(),
    ]);
    expect(first.id).toBe(second.id);
    expect((first.auth as any).options.popupRedirectResolver).toBe('popup-resolver');
    (first.auth as any).currentUser = user('alice');
    await auth.activateAccount(first.id);
    expect((await auth.prepareGoogleSession()).id).not.toBe(first.id);
  });
  it('ends stalled authentication waits and clears the timeout', async () => {
    const { authDeadline } = await import('../src/integrations/auth');
    vi.useFakeTimers();
    try {
      const pending = authDeadline(new Promise<never>(() => {}), 5000);
      const rejected = expect(pending).rejects.toThrow('took too long');
      await vi.advanceTimersByTimeAsync(5000);
      await rejected;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it('preserves successful results and provider errors without leaving timeout timers', async () => {
    const { authDeadline } = await import('../src/integrations/auth');
    vi.useFakeTimers();
    try {
      await expect(authDeadline(Promise.resolve('signed in'))).resolves.toBe('signed in');
      await expect(authDeadline(Promise.reject(Error('provider failed')))).rejects.toThrow(
        'provider failed',
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it('adds two authenticated sessions, switches between them, and keeps guest explicit', async () => {
    const auth = await import('../src/integrations/auth');
    await auth.initializeAccounts();
    const first = await auth.newAccountSession(),
      second = await auth.newAccountSession();
    (first.auth as any).currentUser = user('alice');
    await auth.activateAccount(first.id);
    (second.auth as any).currentUser = user('bob');
    await auth.activateAccount(second.id);
    expect(auth.accountState().accounts).toHaveLength(2);
    expect(auth.accountState().active?.uid).toBe('bob');
    auth.switchAccount(first.id);
    expect(auth.accountState().active?.uid).toBe('alice');
    auth.switchAccount(null);
    expect(auth.accountState().active).toBeNull();
    expect(auth.accountState().accounts).toHaveLength(2);
  });
  it('reuses an already signed-in identity rather than creating duplicate account libraries', async () => {
    const auth = await import('../src/integrations/auth');
    await auth.initializeAccounts();
    const first = await auth.newAccountSession();
    (first.auth as any).currentUser = user('alice');
    await auth.activateAccount(first.id);
    const duplicate = await auth.newAccountSession();
    (duplicate.auth as any).currentUser = user('alice');
    await auth.activateAccount(duplicate.id);
    expect(auth.accountState().accounts).toHaveLength(1);
    expect(auth.accountState().active?.id).toBe(first.id);
    expect(duplicate.auth.currentUser).toBeNull();
  });
  it('cannot activate a session that has not authenticated, and signs out only the requested account', async () => {
    const auth = await import('../src/integrations/auth');
    await auth.initializeAccounts();
    const first = await auth.newAccountSession();
    (first.auth as any).currentUser = user('alice');
    await auth.activateAccount(first.id);
    const empty = await auth.newAccountSession();
    await expect(auth.activateAccount(empty.id)).rejects.toThrow('Sign in again');
    expect(auth.accountState().active?.uid).toBe('alice');
    const second = await auth.newAccountSession();
    (second.auth as any).currentUser = user('bob');
    await auth.activateAccount(second.id);
    await auth.signOutAccount(first.id);
    expect(auth.accountState().active?.uid).toBe('bob');
    expect(auth.accountState().accounts).toHaveLength(1);
  });
  it('does not silently sign back into the legacy primary account after the user selected guest', async () => {
    mock.session.set('pocket-active-auth', '');
    mock.session.set('pocket-auth-slots', '["primary"]');
    mock.auth.set('pocket', {
      currentUser: user('alice'),
      authStateReady: async () => {},
      listeners: new Set(),
    });
    const auth = await import('../src/integrations/auth');
    await auth.initializeAccounts();
    expect(auth.accountState().accounts).toHaveLength(1);
    expect(auth.accountState().active).toBeNull();
  });
});
