// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { currentRoute, featureContent, updateSEO } from '../src/seo/routes';
import { structuredData } from '../src/seo/schema';
it('resolves each focused workflow to an existing tool and preserves its presets', () => {
  for (const [id, feature] of Object.entries(featureContent)) {
    history.replaceState({}, '', '/' + feature.slug + '/');
    expect(currentRoute()).toEqual({ view: 'tool', toolId: feature.toolId, featureId: id });
  }
  expect(featureContent['pdf-to-png'].options.format).toBe('png');
  expect(featureContent['persian-ocr'].options.language).toBe('fas');
  expect(featureContent['arabic-ocr'].options.language).toBe('ara');
});
it('replaces all route metadata and structured data during SPA navigation', () => {
  for (const id of ['pdf-to-png', 'persian-ocr']) {
    const feature = featureContent[id];
    updateSEO({ view: 'tool', toolId: feature.toolId, featureId: id });
    expect(document.title).toBe(feature.title + ' · Plivvi');
    expect(document.head.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(
      document.title,
    );
    const canonical = document.head.querySelector('link[rel="canonical"]')!.getAttribute('href')!;
    expect(canonical).toMatch(new RegExp('/' + feature.slug + '/$'));
    const ld = JSON.parse(document.head.querySelector('#plivvi-seo-data')!.textContent!);
    expect(
      ld['@graph'].find((node: Record<string, string>) => node['@type'] === 'WebPage').url,
    ).toBe(canonical);
    expect(document.head.querySelectorAll('#plivvi-seo-data')).toHaveLength(1);
  }
  updateSEO({ view: 'documents' });
  expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
    'noindex,nofollow',
  );
  updateSEO({ view: 'home' });
  expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
    'index,follow',
  );
});
it('identifies the website and free app without invented reviews or ratings', () => {
  const ld = structuredData('https://plivvi.pages.dev', '/', 'Plivvi', 'Free document tools');
  expect(ld['@graph']).toContainEqual(
    expect.objectContaining({
      '@type': 'WebSite',
      name: 'Plivvi',
      url: 'https://plivvi.pages.dev/',
    }),
  );
  expect(JSON.stringify(ld)).not.toContain('aggregateRating');
});
