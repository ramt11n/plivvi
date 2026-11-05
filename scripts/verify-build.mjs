import { readFile, stat } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
const content = {
    ...JSON.parse(await readFile('src/seo/content.json', 'utf8')),
    ...JSON.parse(await readFile('src/seo/features.json', 'utf8')),
  },
  sitemap = await readFile('dist/sitemap.xml', 'utf8');
for (const [id, tool] of Object.entries(content)) {
  const html = await readFile(`dist/${tool.slug}/index.html`, 'utf8');
  assert(html.includes('<h1>'), `${id}: no pre-rendered heading`);
  assert(
    html.includes(
      tool.description.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      ),
    ),
    `${id}: missing description`,
  );
  assert(html.includes(`/${tool.slug}/`), `${id}: missing canonical path`);
  const expectedDescription = tool.description.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
  assert(
    html.includes(`<meta name="description" content="${expectedDescription}">`),
    `${id}: wrong head description`,
  );
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
  assert.equal(canonical, `https://plivvi.pages.dev/${tool.slug}/`);
  const ld = JSON.parse(
    html.match(/<script id="plivvi-seo-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  assert.equal(ld['@graph'].find((node) => node['@type'] === 'WebPage').url, canonical);
  assert.equal((html.match(/id="plivvi-seo-data"/g) ?? []).length, 1);
  assert(html.includes('application/ld+json'), `${id}: missing structured data`);
  assert(sitemap.includes('/' + tool.slug + '/'), `${id}: missing sitemap route`);
}
const callback = await readFile('dist/redirect.html', 'utf8');
assert(callback.includes('noindex'));
assert(!callback.includes('id="root"'), 'MSAL callback must remain separate from the SPA');
const account = await readFile('dist/account/index.html', 'utf8');
assert(account.includes('noindex,nofollow'));
assert(!sitemap.includes('/documents/'));
assert(!sitemap.includes('/account/'));
const social = await stat('dist/og.png');
assert(social.size > 1000, 'Social preview missing');
const source = await stat('dist/source.zip');
assert(source.size > 1000, 'Source download missing');
console.log(
  `Verified ${Object.keys(content).length} tool pages, sitemap, account privacy rules, source archive, and social preview.`,
);
const mainPages = JSON.parse(await readFile('src/seo/site-pages.json', 'utf8'));
const guides = JSON.parse(await readFile('src/seo/guides.json', 'utf8'));
const escapeHTML = (value) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
for (const page of [
  ...Object.values(mainPages),
  ...Object.values(guides).map((g) => ({ ...g, path: '/guides/' + g.slug + '/' })),
]) {
  const html = await readFile('dist' + page.path + 'index.html', 'utf8');
  assert(
    html.includes('<title>' + escapeHTML(page.title) + '</title>'),
    page.path + ': static title mismatch',
  );
  assert(
    html.includes('<meta name="description" content="' + escapeHTML(page.description) + '">'),
    page.path + ': static description mismatch',
  );
  if (page.sections)
    for (const section of page.sections)
      for (const paragraph of section.paragraphs)
        assert(html.includes(escapeHTML(paragraph)), page.path + ': guide missing content');
}
const manifest = JSON.parse(await readFile('dist/search-manifest.json', 'utf8'));
const expectedCount =
  Object.keys(content).length + Object.keys(mainPages).length + Object.keys(guides).length;
assert.equal(manifest.entries.length, expectedCount);
const categorized = [];
for (const name of ['pages', 'tools', 'guides']) {
  const xml = await readFile('dist/sitemaps/' + name + '.xml', 'utf8');
  categorized.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
}
assert.equal(new Set(categorized).size, expectedCount);
assert.deepEqual(new Set(categorized), new Set(manifest.entries.map((entry) => entry.url)));
const robots = await readFile('dist/robots.txt', 'utf8');
assert(robots.includes('/sitemap-index.xml'));
for (const icon of ['favicon.ico', 'favicon-96.png', 'icon-180.png', 'icon-512.png'])
  assert((await stat('dist/' + icon)).size > 500);
console.log(
  `Verified shared metadata, four complete guides, ${expectedCount} categorized public URLs, and favicon assets.`,
);
