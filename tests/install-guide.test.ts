import { describe, expect, it } from 'vitest';
import { installPlatform } from '../src/components/InstallGuide';

describe('install guidance', () => {
  it('recognizes iPadOS desktop user agents and the main mobile and desktop browsers', () => {
    expect(installPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Safari', 5)).toBe(
      'ios',
    );
    expect(installPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)', 0)).toBe(
      'ios',
    );
    expect(installPlatform('Mozilla/5.0 (Linux; Android 16) AppleWebKit Chrome/145', 1)).toBe(
      'android',
    );
    expect(installPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Safari', 0)).toBe(
      'mac-safari',
    );
    expect(installPlatform('Mozilla/5.0 (Windows NT 10.0) Firefox/146', 0)).toBe('desktop-firefox');
    expect(installPlatform('Mozilla/5.0 (Windows NT 10.0) Chrome/145 Edg/145', 0)).toBe(
      'desktop-chromium',
    );
  });
});
