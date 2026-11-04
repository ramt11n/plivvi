import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';
import { tools } from '../src/lib/catalog.ts';
import { structuredData } from '../src/seo/schema.ts';
const features = JSON.parse(await readFile('src/seo/features.json', 'utf8'));
const brand = JSON.parse(await readFile('src/brand.json', 'utf8'));
const identity = (value) => String(value).replaceAll('{brand}', brand.name);
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env },
  origin = (env.VITE_SITE_URL || 'https://plivvi.pages.dev').replace(/\/$/, ''),
  content = JSON.parse(await readFile('src/seo/content.json', 'utf8')),
  base = await readFile('dist/index.html', 'utf8');
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const schema = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const nav =
  '<nav aria-label="Main navigation"><a href="/">{brand}.</a><a href="/pdf-reader/">PDF reader</a><a href="/tools/">All tools</a><a href="/notebooks/">Free notebooks</a><a href="/about/">About</a><a href="/support/">Support</a><a href="/contact/">Contact</a></nav>';
const footer =
  '<footer><p>Free. Open source. Vibe coded. Made by <a href="https://github.com/ramt11n">Ramtin Neshatvar</a>.</p><a href="/privacy/">Privacy</a> · <a href="/source.zip">Application source</a> · <a href="mailto:ramtinneshat4@gmail.com">Contact & sponsorship</a></footer>';
const routes = [];
async function page(route, title, description, body, ld = {}, index = true) {
  const url = origin + route,
    head = `<link rel="canonical" href="${esc(url)}"><meta name="robots" content="${index ? 'index,follow' : 'noindex,nofollow'}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${origin}/og.png"><meta property="og:site_name" content="{brand}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${origin}/og.png"><meta property="og:image:alt" content="Plivvi — free PDF tools and digital notebooks"><script id="plivvi-seo-data" type="application/ld+json">${schema(structuredData(origin, route, title, description, Object.entries(content).find(([, d]) => route === '/' + d.slug + '/')?.[0] ?? Object.values(features).find((d) => route === '/' + d.slug + '/')?.toolId))}</script>`;
  let html = base
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${esc(description)}">`,
    )
    .replace('</head>', head + '</head>')
    .replace(
      '<div id="root"></div>',
      `<div id="root"><div class="seo-prerender">${nav}<main>${body}</main>${footer}<noscript><p>Document processing needs JavaScript and WebAssembly. These guides are available without JavaScript.</p></noscript></div></div>`,
    );
  html = identity(html);
  const destination = route === '/' ? 'dist/index.html' : `dist${route}index.html`;
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html);
  if (index) routes.push(route);
  return html;
}
const links =
  tools
    .map(
      (t) =>
        `<a class="seo-tool-link" href="/${content[t.id].slug}/"><strong>${esc(t.title)}</strong><span>${esc(t.description)}</span></a>`,
    )
    .join('') +
  Object.values(features)
    .map(
      (f) =>
        `<a class="seo-tool-link" href="/${f.slug}/"><strong>${esc(f.title.split(' — ')[0])}</strong><span>${esc(f.description)}</span></a>`,
    )
    .join('');
const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '{brand}',
  url: origin,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web browser',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'Ramtin Neshatvar', url: 'https://github.com/ramt11n' },
  license: origin + '/LICENSE.txt',
  description: 'Free, open-source, vibe-coded PDF tools with browser-local document processing.',
};
await page(
  '/',
  '{brand} — Free PDF Tools, Editor & Digital Notebooks',
  'Free PDF reader, scanner, editor, converter, OCR, merge, split, and document tools. Open source and vibe coded by Ramtin Neshatvar.',
  `<span class="eyebrow">FREE. OPEN SOURCE. VIBE CODED.</span><h1>A little less paperwork.</h1><p>Read, annotate, scan, sign, merge, split, and convert documents on your device. Camera capture and sign-in are optional. Every document feature is free.</p><a href="/pdf-reader/">Open the PDF reader & editor</a><h2>A tool for every little task.</h2><div class="seo-tools">${links}</div><h2>Your files. Your choice.</h2><p>Documents are processed in your browser. Save outputs locally, download a copy, or choose an optional cloud connection. Loaded tools can be cached for offline use.</p>`,
  appSchema,
);
await page(
  '/tools/',
  'Free PDF Tools — {brand}',
  'Browse all free PDF tools for reading, editing, scanning, conversion, OCR, organization, and protection. No document feature paywalls.',
  `<h1>Free tools for your everyday paperwork.</h1><p>Choose a task, add your file, and make a new copy. Every tool is available without a subscription or required account.</p><div class="seo-tools">${links}</div>`,
  appSchema,
);
await page(
  '/notebooks/',
  'Free Digital Notebook & Apple Pencil Writing — {brand}',
  'Create free notebooks with lined, dotted, grid, Cornell, or blank paper. Handwrite, type, add photos, and export PDF or images. No subscription.',
  '<h1>A fresh page. A world of possibility.</h1><p>Free digital notebooks for handwritten notes, study, sketches, and planning. Keep notebook pages and ink on your device, with optional account workspaces.</p><h2>Make paper work your way</h2><p>Choose ruled, dotted, graph, Cornell, or blank pages. Duplicate, reorder, or add pages as your ideas grow. Write with Apple Pencil or another digital pen using pressure and tilt where supported by your browser. Add photographs and multilingual text.</p><h2>Your notes, yours to keep</h2><p>Export PDF, PNG, or JPG, and back up through Files. Local notebook storage does not automatically sync across devices. Apple Pencil hardware features vary by iPad, Pencil model, and browser. Native squeeze and double-tap actions are not exposed by the web editor.</p><h2>What does Plivvi mean?</h2><p>Plivvi is an invented name, pronounced PLIV-ee. It is a little space for your next good idea.</p>',
  { ...appSchema, name: '{brand} Digital Notebooks' },
);
for (const tool of [
  ...tools,
  ...Object.entries(features).map(([id, data]) => ({
    ...tools.find((tool) => tool.id === data.toolId),
    id,
  })),
]) {
  const d = content[tool.id] ?? features[tool.id],
    route = '/' + d.slug + '/',
    steps = d.steps.map((s, i) => `<li><span>${i + 1}</span><p>${esc(s)}</p></li>`).join(''),
    faqs = d.faqs
      .map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
      .join('');
  await page(
    route,
    d.title + ' · {brand}',
    d.description,
    `<article class="tool-landing"><div class="tool-landing-hero"><span class="eyebrow">FREE. OPEN SOURCE. ON YOUR DEVICE.</span><h1>${esc(d.title.split(' — ')[0])}</h1><p>${esc(d.description)}</p><a class="button primary" href="#start">${esc(tool.action)}</a><p>No feature paywalls. Sign-in is optional.</p></div><section class="tool-guide" id="start"><div><h2>${esc(d.heading)}</h2><p>${esc(tool.description)} ${esc(tool.note ?? 'Create a new output while keeping your original file unchanged.')}</p></div><ol>${steps}</ol></section><section class="tool-faq"><h2>A few useful answers.</h2>${faqs}<details><summary>Can I use it on a phone or tablet?</summary><p>Yes. {brand} adapts to modern phones, tablets, laptops, and desktop browsers. File import works without a camera. Load tools online before relying on offline use.</p></details></section><p>Keep the tools free: <a href="/support/">sponsor the project</a>, <a href="/contact/">send feedback</a>, or contribute to the open-source application.</p><h2>More document tools</h2><div class="seo-tools">${tools
      .filter((t) => t.id !== tool.id && t.group === tool.group)
      .slice(0, 4)
      .map((t) => `<a href="/${content[t.id].slug}/">${esc(t.title)}</a>`)
      .join('')}</div></article>`,
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          ...appSchema,
          '@context': undefined,
          name: d.title.split(' — ')[0],
          url: origin + route,
          description: d.description,
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '{brand}', item: origin + '/' },
            { '@type': 'ListItem', position: 2, name: tool.title, item: origin + route },
          ],
        },
      ],
    },
  );
}
const pages = {
  about: [
    'About {brand} — Open Source & Vibe Coded',
    'Meet {brand}, a free and open-source PDF toolkit made by Ramtin Neshatvar.',
    '<h1>Paperwork deserves a friendlier place.</h1><p>{brand} is free, open-source, and proudly vibe coded. Ramtin Neshatvar uses AI-assisted development, practical tests, and open community contributions to build useful everyday document tools.</p><h2>Source available. Features free.</h2><p>The app is distributed under AGPL-3.0-or-later. You can inspect, improve, and run the source yourself. Known limits and build instructions are documented with the project.</p><h2>Meet the maker</h2><p><a href="https://github.com/ramt11n">Ramtin Neshatvar on GitHub</a> · <a href="https://linkedin.com/in/ramtin-neshatvar-185534263">LinkedIn</a> · <a href="https://ramtin-neshatvar-cv.asa-adv-agency2.chatgpt.site">CV</a></p>',
  ],
  privacy: [
    'Privacy — {brand}',
    'How {brand} handles local documents, optional accounts, cloud connections, and sponsorship.',
    '<h1>Your paperwork stays yours.</h1><h2>Local processing</h2><p>PDF, image, and OCR operations run in your browser. Engine code and language packs download when needed, but your document is not part of those requests.</p><h2>Browser storage</h2><p>Workspace outputs and reader drafts stay in this browser. They do not sync automatically and may be removed if browser data is cleared. Download important copies.</p><h2>Accounts and cloud</h2><p>When enabled, Firebase handles optional authentication. Google Drive and OneDrive transfer selected files directly between your browser and the chosen provider only when you request import or export.</p><h2>Sponsorship</h2><p>Current sponsor placements are first-party content and email links. There are no active advertising-network scripts or behavioral trackers. Hosting receives normal website request metadata.</p><p>Questions: <a href="mailto:ramtinneshat4@gmail.com">ramtinneshat4@gmail.com</a>.</p>',
  ],
  contact: [
    'Contact Ramtin — {brand}',
    'Contact Ramtin Neshatvar for feedback, sponsorship, contributions, or custom document workflows.',
    '<h1>Say hello to Ramtin.</h1><p>Contact <a href="mailto:ramtinneshat4@gmail.com">ramtinneshat4@gmail.com</a> for questions, sponsorship, bug reports, or custom workflow help.</p><h2>Help reproduce a bug</h2><p>Include the tool, browser, device, and reproduction steps. Use synthetic or anonymized samples and keep private documents, passwords, and identifiers out of public reports.</p><p><a href="https://github.com/ramt11n">GitHub</a> · <a href="https://linkedin.com/in/ramtin-neshatvar-185534263">LinkedIn</a></p>',
  ],
  support: [
    'Support {brand} — Keep Every Feature Free',
    'Support Plivvi with optional crypto donations: USDT on five networks, Bitcoin, Ethereum, and more. Keep every open-source document tool free.',
    '<h1>A free workshop can still have a future.</h1><p>Support maintenance, testing, and better document workflows through direct sponsorship. Every reader, scanner, and PDF feature remains free.</p><h2>Donate crypto, directly to the maker</h2><p>Choose USDT on Ethereum (ERC-20), TRON (TRC-20), BNB Smart Chain (BEP-20), Polygon, or Avalanche C-Chain. Bitcoin, ETH, SOL, TWT, TRX, DOGE, POL, XRP, and BCH receiving options are also available. Select the exact asset and network before opening Trust Wallet or copying an address. Donations are optional; every feature stays free.</p><h2>Support the project</h2><p>Discuss a community-support credit or ongoing sponsorship with Ramtin.</p><h2>Sponsor a useful tool</h2><p>Clearly labeled placements can appear on public guides, away from private document views. Audience numbers and paid impressions are not invented or guaranteed.</p><h2>Custom workflow help</h2><p>Contact Ramtin about separate paid setup, branding, or custom workflow work.</p><p><a href="mailto:ramtinneshat4@gmail.com?subject=Sponsor%20{brand}%20PDF%20Workshop">Discuss sponsorship</a>. Pricing and scope are agreed directly before publication.</p>',
  ],
  templates: [
    'Document Templates & Copy Layouts — {brand}',
    'Start with blank, lined, graph, invoice, letter, and checklist pages, or arrange genuine identity-document scans.',
    '<h1>Start one step ahead.</h1><p>Choose blank paper, lined notes, graph paper, a formal letter, a simple invoice, or a checklist. Open the result in the reader to type, draw, and annotate.</p><h2>Document copy layouts</h2><p>ID front-and-back and passport-copy presets arrange authentic scans you provide. They do not create credentials or promise acceptance by government agencies.</p>',
  ],
};
for (const [route, [title, description, body]] of Object.entries(pages))
  await page(
    '/' + route + '/',
    title,
    description,
    `<article class="public-page">${body}</article>`,
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      url: origin + '/' + route + '/',
    },
  );
await page(
  '/documents/',
  'Your Local Documents · {brand}',
  'Your browser-local document workspace.',
  '<h1>Your local documents</h1><p>This workspace is stored in the current browser. JavaScript is required to display your saved outputs.</p>',
  {},
  false,
);
await page(
  '/account/',
  'Optional Account · {brand}',
  'Optional account sign-in. Every PDF feature also works as a guest.',
  '<h1>A small account. No paywalls.</h1><p>Every PDF tool works without signing in. Optional account availability depends on this deployment.</p>',
  {},
  false,
);
const notFound = await page(
  '/404/',
  'Page Not Found · {brand}',
  'Find a document tool or return to {brand}.',
  '<h1>That page isn’t in this pocket.</h1><p><a href="/tools/">Explore the document tools</a> or <a href="/">return home</a>.</p>',
  {},
  false,
);
await writeFile('dist/404.html', notFound);
await writeFile(
  'dist/sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    routes.map((route) => `<url><loc>${esc(origin + route)}</loc></url>`).join('') +
    '</urlset>',
);
await writeFile(
  'dist/robots.txt',
  `User-agent: *\nAllow: /\nDisallow: /documents/\nDisallow: /account/\nDisallow: /redirect.html\nSitemap: ${origin}/sitemap.xml\n`,
);
console.log(
  `Generated ${routes.length} indexable pages, private-page noindex rules, sitemap, and social metadata for ${origin}`,
);
