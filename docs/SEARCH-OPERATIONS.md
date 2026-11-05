# Search operations

## Published content

`src/seo/site-pages.json` supplies main-page metadata to the build and SPA. `content.json` and `features.json` supply 45 tool/workflow pages. `guides.json` supplies four original workflow articles, author attribution, steps and related tools. Their complete text is available in the initial HTML and in the app.

Titles and descriptions are unique. Canonicals, Open Graph, Twitter cards, WebSite/Organization/WebApplication data and breadcrumbs use the public deployment origin. Guide articles add Article data. No invented ratings, reviews or audience claims are used. These properties help engines understand the site; they do not guarantee rich results.

Set `VITE_SITE_URL` to the final HTTPS origin. Keep one canonical host. The GitHub project page points its canonical to the main site's About page. Workspace, account, authentication callbacks and unknown routes are not search landing pages.

## Sitemap and favicon

Submit `https://plivvi.pages.dev/sitemap-index.xml` in Search Console. It references `/sitemaps/pages.xml`, `/sitemaps/tools.xml` and `/sitemaps/guides.xml`. The legacy `/sitemap.xml` continues to contain all public routes. XML responses have explicit MIME headers. Robots references the index. Update the content modification date in `scripts/generate-seo.mjs` when public text materially changes; do not set fresh dates merely to influence crawlers.

The stable `/favicon.ico` and `/favicon-96.png` are simple face marks for small search/browser surfaces. Install icons use the original head-and-shoulders character with the actual Sora wordmark. Their manifest query versions change with releases. Browsers and search engines control how quickly cached icons update.

## Changed-content notification

`src/seo/indexnow.json` contains a **public ownership proof**, not a private API credential. Its matching root text file must be deployed. It cannot access accounts or user documents.

Before deployment:

```sh
node scripts/search-notifications.mjs --snapshot=.sites-runtime/search-before.json
```

After deploying and verifying the public site:

```sh
node scripts/audit-live-seo.mjs
node scripts/search-notifications.mjs --previous=.sites-runtime/search-before.json
```

The script compares semantic content hashes in `/search-manifest.json`; it submits added, changed and removed public URLs to IndexNow. Unchanged pages are not repeatedly submitted. The script rejects foreign origins, private workspace paths, query strings and fragments. No document contents or visitor state are submitted.

HTTP 200 means received. HTTP 202 means accepted with proof validation pending. Neither means indexed. A local receipt is saved in `.sites-runtime/indexnow-receipt.json`; successful submissions also save the manifest to avoid redundant manual notifications. The Cloudflare workflow runs these steps when the owner-configured deployment job is enabled. Until project variables and deployment credentials exist, that workflow remains opt-in and the dashboard upload is used.

## Public verification

`npm test`, `npm run build` and `node scripts/verify-build.mjs` verify routes, shared metadata, complete guide copy, schema, sitemaps and private-page exclusions. `node scripts/audit-live-seo.mjs` independently fetches every public URL, verifies HTTP status/MIME, static headings, unique titles/descriptions, exact canonicals and structured data, plus private-page noindex and a real 404. This verifies technical delivery; it does not measure Core Web Vitals from real visitors.

Inspect Search Console for crawl failures after deployment. Resubmit a changed sitemap once and use URL inspection for a few priority pages. Do not automate Google's general Indexing API: it is not intended for ordinary PDF tool landing pages. Do not loop around indexing quotas. Google's crawl/index refresh and ranking remain outside the application's control.

## Sustainable visibility

The repository README and release notes link to the live tools and guides. Useful tutorials, public fixes and real community contributions are more durable than bulk directory submissions or repeated keyword pages. Publish new guides only when they demonstrate an actual workflow and add useful content. Obtain authorization before posting to communities or sending promotional email. Search traffic and revenue are not guaranteed.
