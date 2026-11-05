// Public HTTP checks, independent of JavaScript execution and owner sessions.
import { mkdir, writeFile } from 'node:fs/promises';
const origin = (process.env.VITE_SITE_URL || 'https://plivvi.pages.dev').replace(/\/$/, '');
const failures = [],
  checks = [];
const get = async (path) => {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(25000),
    cache: 'no-store',
  });
  return {
    status: response.status,
    type: response.headers.get('content-type') || '',
    text: await response.text(),
    url: response.url,
  };
};
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const robots = await get('/robots.txt');
expect(
  robots.status === 200 && robots.text.includes(origin + '/sitemap-index.xml'),
  'robots.txt: sitemap index missing',
);
const index = await get('/sitemap-index.xml');
expect(
  index.status === 200 && /(?:application|text)\/xml/.test(index.type),
  'Sitemap index: wrong status or MIME',
);
let urls = [];
for (const sitemap of locs(index.text)) {
  expect(sitemap.startsWith(origin + '/sitemaps/'), 'Unexpected sitemap origin');
  if (!sitemap.startsWith(origin + '/sitemaps/')) continue;
  const child = await get(sitemap);
  expect(
    child.status === 200 && /(?:application|text)\/xml/.test(child.type),
    sitemap + ': wrong status or MIME',
  );
  urls.push(...locs(child.text));
}
expect(
  urls.length > 45 && new Set(urls).size === urls.length,
  'Public route count or duplicate sitemap entries',
);
const titles = new Set(),
  descriptions = new Set();
let next = 0;
async function worker() {
  while (next < urls.length) {
    const url = urls[next++];
    expect(new URL(url).origin === origin, url + ': unexpected origin');
    if (new URL(url).origin !== origin) continue;
    try {
      const page = await get(url);
      const title = page.text.match(/<title>([^<]+)<\/title>/)?.[1];
      const description = page.text.match(/<meta name="description" content="([^"]+)"/)?.[1];
      const canonical = page.text.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      expect(page.status === 200, url + ': HTTP ' + page.status);
      expect(page.type.includes('text/html'), url + ': wrong MIME');
      expect(!!title && !titles.has(title), url + ': missing or duplicate title');
      titles.add(title);
      expect(
        !!description && !descriptions.has(description),
        url + ': missing or duplicate description',
      );
      descriptions.add(description);
      expect(canonical === url, url + ': wrong canonical');
      expect(
        page.text.includes('<h1>') && page.text.includes('class="seo-prerender"'),
        url + ': no static content',
      );
      expect(page.text.includes('content="index,follow"'), url + ': not indexable');
      const ld = JSON.parse(
        page.text.match(
          /<script id="plivvi-seo-data" type="application\/ld\+json">([\s\S]*?)<\/script>/,
        )?.[1] || 'null',
      );
      expect(
        ld?.['@graph']?.some((node) => node.url === url),
        url + ': structured data mismatch',
      );
      expect(page.text.includes(origin + '/og.png'), url + ': no social preview');
      checks.push({ url, status: page.status, title, canonical });
    } catch (error) {
      failures.push(url + ': ' + error.message);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
for (const route of ['/documents/', '/account/']) {
  const page = await get(route);
  expect(
    page.text.includes('noindex,nofollow') && !urls.includes(origin + route),
    route + ': private page indexing',
  );
}
const missing = await get('/seo-check-nonexistent-page/');
expect(missing.status === 404, 'Unknown URL is a soft 404');
for (const route of ['/favicon.ico', '/favicon-96.png', '/icon-512.png', '/og.png']) {
  const asset = await get(route);
  expect(asset.status === 200 && asset.type.startsWith('image/'), route + ': missing image');
}
await mkdir('.sites-runtime', { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  origin,
  pages: checks.length,
  failures,
  checks,
};
await writeFile('.sites-runtime/live-seo-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pages: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
