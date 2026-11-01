import { describe, it, expect, vi } from 'vitest';
import {
  cloudCopyName,
  validGraphUrl,
  connectGoogle,
  cloudConnections,
} from '../src/integrations/cloud';
vi.mock('../src/integrations/config', () => ({
  brand: { name: 'Plivvi' },
  integrationConfig: async () => ({ google: { clientId: 'public-test-client' } }),
}));
describe('cloud copy safety', () => {
  it('ends stalled Google consent and ignores a callback arriving after its timeout', async () => {
    let callback: (result: unknown) => void = () => {};
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: (options: { callback: typeof callback }) => {
              callback = options.callback;
              return { requestAccessToken: () => {} };
            },
          },
        },
      },
    });
    try {
      const connecting = connectGoogle('stalled-consent');
      const rejected = expect(connecting).rejects.toThrow('did not finish connecting');
      await vi.advanceTimersByTimeAsync(120000);
      await rejected;
      callback({ access_token: 'late-test-token', expires_in: 3600 });
      expect(await cloudConnections('stalled-consent')).toEqual({
        google: undefined,
        microsoft: undefined,
      });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it('preserves extensions and creates distinct legal destination names', () => {
    const first = cloudCopyName('Report: draft?.pdf'),
      second = cloudCopyName('Report: draft?.pdf');
    expect(first.endsWith('.pdf')).toBe(true);
    expect(first).not.toMatch(/[:?]/);
    expect(first).not.toBe(second);
    expect(cloudCopyName('README')).toMatch(/^README-/);
  });
  it('rejects pagination addresses that would send a provider token to another host', () => {
    expect(
      validGraphUrl('https://graph.microsoft.com/v1.0/me/drive/root/children?$skiptoken=test'),
    ).toContain('graph.microsoft.com');
    for (const bad of [
      'https://example.com/v1.0/me/drive/root/children',
      'https://graph.microsoft.com.evil.test/v1.0/me/drive/root/children',
      'http://graph.microsoft.com/v1.0/me/drive/root/children',
    ])
      expect(() => validGraphUrl(bad)).toThrow();
  });
});
