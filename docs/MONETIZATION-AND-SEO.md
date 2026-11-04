# Keep every document feature free

The release supports optional direct crypto donations, direct sponsorship and paid custom workflow help through `plivvi.pages@gmail.com`. Sponsor invitations appear on public pages, with no feature locks, invented visitor counts, or fake paying sponsors. A visitor can use the workshop without an account.

## Practical income options

- Sell a clearly labeled sponsor placement on a public tool guide after agreeing scope directly.
- Offer optional setup, branding, or custom document-workflow services to organizations.
- Consider eligible donation/affiliate services only after the owner has an approved account and supplies real destinations. Disclose paid relationships.
- Add an advertising network only after publisher eligibility, site approval, consent handling, and its technical requirements are settled.

There is no active ad-network publisher ID or payment account in this source. Sponsorship invitations make it possible for customers to contact the owner; they do not guarantee revenue.

## Advertising prerequisites

AdSense requires an eligible publisher account, identity/payment setup, ownership verification, and a site review. Do not paste a placeholder `ca-pub` ID and claim ads are running. Use the real publisher-specific `ads.txt` record only after approval. Some regions require a Google-certified consent-management platform. Advertising code must not get access to private reader/document DOM or file data. This version therefore uses first-party sponsorship content rather than inserting third-party ad scripts into the SPA.

If the publisher is based in Iran, Google says AdSense is unavailable and access is blocked while physically there. Do not assume eligibility from a VPN or suggest bypassing country restrictions. Direct sponsorship/custom-work arrangements still need to use services legally available to the owner.

[Eligibility](https://support.google.com/adsense/answer/9724), [site review](https://support.google.com/adsense/answer/12169212), [ads.txt](https://support.google.com/adsense/answer/12171612), [consent](https://support.google.com/adsense/answer/13554116), [country restrictions](https://support.google.com/adsense/answer/6167308).

## Technical SEO included

- Real tool URLs using the History API, with static HTML generated for each route.
- Unique titles, descriptions, canonical URLs, original instructions, scope limits, and useful questions for each tool.
- Crawlable internal links, a tool directory, XML sitemap, robots rules, 404 output, Open Graph/Twitter preview metadata, and software/breadcrumb structured data.
- Creator attribution, About, Contact, sponsorship, privacy, and source/license pages.
- `noindex` for local document and account pages; authentication callbacks excluded from indexing.
- Small initial application code, lazy document/OCR/authentication engines, responsive layout, and reduced-motion support.

The routes hydrate into the same client application for SPA navigation. The generated HTML presents the same tools and scope as the interactive page; it is not a hidden keyword index. [Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## Owner actions after public launch

1. Set a single canonical production origin, and keep it stable where practical.
2. Verify that origin in Google Search Console/Bing Webmaster Tools using your own accounts and submit `sitemap.xml` there.
3. Add the live website URL and relevant topics to the public GitHub repository.
4. Publish accurate release notes and useful examples. Share the project in appropriate communities under their rules; avoid bulk unsolicited promotion.
5. Improve the tools using real bug reports, usage feedback, accessibility checks, and measured performance.

SEO cannot guarantee rankings, fame, traffic, ad acceptance, or income. A free short link is a convenience redirect, not an SEO strategy or a permanent ownership guarantee.

## Version 3.2 search and support additions

The build creates 53 indexable pages: 35 core tools, ten focused conversion/handwriting/language workflows, and eight public site pages. Each focused route has original instructions, limits, FAQs, exact self-canonical URL, social metadata, and matching WebPage/WebApplication/breadcrumb data. The SPA refreshes structured data and Twitter metadata on navigation. The tools directory and related workflow links expose the routes to crawlers. Persian/Arabic OCR links select actual OCR language settings; they are English guides, not translated interfaces, so no fabricated hreflang is emitted.

Homepage WebSite data identifies Plivvi and its alternate descriptive name. Source metadata links the renamed repository. The GitHub project landing page canonicals to the app's About page. Google site-verification metadata is included for the owner's Search Console property. Verification and sitemap acceptance are operational steps to confirm after publishing, not assumed from the presence of a meta tag.

Optional donations use the owner's supplied receiving details. See [configuration and design research](DONATIONS.md). Account/document paths are noindex, and search metadata contains no private file names or content. No extra analytics or third-party ad scripts were added for SEO.

Primary references: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [site names](https://developers.google.com/search/docs/appearance/site-names), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and [GitHub repository renaming](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository). Renamed repository links redirect; GitHub Pages project URLs are an exception and use the new repository name.

## 3.3 support, privacy and updates

Support invitations fund improvements, testing and maintenance as well as free access. They never gate an export. An export invitation appears once per session and dismissal suppresses it for seven days. Receiving networks remain an explicit owner-supplied allowlist; adding an arbitrary token search does not create a safe receiving route. Crypto logos are locally hosted, attributed identification assets.

Private bug reports are submitted through the optional Google Forms embed. It loads only after a visitor chooses it; no document is attached and response summaries are not public. The owner receives response notifications at the business inbox. Public GitHub and email routes remain available.

A same-origin, uncached version endpoint checks actual Plivvi reachability. A device reporting “online” does not prove the host is reachable. Checking for updates does not reload work; applying one is explicit and flushes pending reader drafts first. It cannot bypass filtering, repair a VPN, or promise availability in every network. Static files are hosted on Cloudflare Pages; customer documents stay in browser memory/storage or transfer directly to a cloud provider only when chosen. Hosting plans and quotas can change: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

Continue reviewing Search Console crawl and sitemap results; successful live fetches are not proof of indexing or rankings. Google says indexing can take time: [missing pages](https://support.google.com/webmasters/answer/7474347), [sitemap report](https://support.google.com/webmasters/answer/7451001). Promotional copy should describe demonstrated behavior and known conversion limits. Prefer original examples, relevant open-source contributions and user-approved community posts over mass promotion.
