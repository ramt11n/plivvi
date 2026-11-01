import { describe, it, expect } from 'vitest';
import { cloudCopyName, validGraphUrl } from '../src/integrations/cloud';
describe('cloud copy safety', () => {
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
