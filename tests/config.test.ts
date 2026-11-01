import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const baked = {
  firebase: { apiKey: 'public-key', authDomain: 'example.test', projectId: 'test', appId: 'test' },
  google: { clientId: 'baked-client', apiKey: 'baked-picker', appId: '123' },
};
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('__PLIVVI_PUBLIC_CONFIG__', baked);
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
  vi.stubEnv('VITE_GOOGLE_API_KEY', '');
  vi.stubEnv('VITE_GOOGLE_APP_ID', '');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('public provider configuration', () => {
  it('keeps the built-in provider configuration when runtime fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('offline')));
    const { integrationConfig } = await import('../src/integrations/config');
    expect((await integrationConfig()).google).toEqual(baked.google);
  });
  it('does not let empty CI variables erase runtime provider values', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ google: { clientId: 'runtime-client' } }),
    }));
    const { integrationConfig } = await import('../src/integrations/config');
    expect((await integrationConfig()).google).toEqual({
      ...baked.google,
      clientId: 'runtime-client',
    });
  });
  it('bounds a stalled configuration response body and falls back to the bundled configuration', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
    vi.stubGlobal('fetch', fetcher);
    const { integrationConfig } = await import('../src/integrations/config');
    const pending = integrationConfig();
    await vi.advanceTimersByTimeAsync(2500);
    expect((await pending).google).toEqual(baked.google);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
