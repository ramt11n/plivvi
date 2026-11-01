import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/integrations/config', () => ({
  integrationConfig: async () => ({ google: { clientId: 'public-client' } }),
}));
beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('direct Google authorization', () => {
  it('requests the sign-in window synchronously and only asks for identity scopes', async () => {
    let requested = false,
      options: any;
    vi.stubGlobal('window', {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: (o: any) => {
              options = o;
              return {
                requestAccessToken: () => {
                  requested = true;
                  queueMicrotask(() => options.callback({ access_token: 'test-token' }));
                },
              };
            },
          },
        },
      },
    });
    const { prepareGoogleIdentity, createGoogleSignInRequest } =
      await import('../src/integrations/googleIdentity');
    const clientId = await prepareGoogleIdentity();
    const request = createGoogleSignInRequest(clientId);
    expect(requested).toBe(false);
    const pending = request();
    expect(requested).toBe(true);
    expect(options.scope).toBe('openid email profile');
    expect(options.include_granted_scopes).toBe(false);
    await expect(pending).resolves.toBe('test-token');
  });
  it('reports a blocked window and clears its deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: (o: any) => ({
              requestAccessToken: () => o.error_callback({ type: 'popup_failed_to_open' }),
            }),
          },
        },
      },
    });
    const { createGoogleSignInRequest } = await import('../src/integrations/googleIdentity');
    await expect(createGoogleSignInRequest('public-client')()).rejects.toThrow('blocked');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('ignores a response arriving after a stalled authorization has timed out', async () => {
    vi.useFakeTimers();
    let options: any;
    vi.stubGlobal('window', {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: (o: any) => {
              options = o;
              return { requestAccessToken() {} };
            },
          },
        },
      },
    });
    const { createGoogleSignInRequest } = await import('../src/integrations/googleIdentity');
    const pending = createGoogleSignInRequest('public-client')();
    const rejected = expect(pending).rejects.toThrow('did not finish');
    await vi.advanceTimersByTimeAsync(120000);
    await rejected;
    options.callback({ access_token: 'late-test-token' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
