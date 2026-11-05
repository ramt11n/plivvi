# Plivvi

**Free. Open source. Proudly vibe coded.** A responsive, installable PDF workshop made by [Ramtin Neshatvar](https://github.com/ramt11n).

[Open the workshop](https://plivvi.pages.dev) · [Project home](https://ramt11n.github.io/plivvi/) · [Contribute](CONTRIBUTING.md) · [Support the maker](https://plivvi.pages.dev/support/) · [AGPL-3.0-or-later](LICENSE)

Read, mark up, scan, organize, sign, and convert documents on your device. No feature subscriptions, no required login, and no document-upload processing backend. Sponsorship and optional paid custom-workflow help support the project without restricting document tools.

## A useful little workshop

- **PDF reader & editor:** crisp lazy-rendered pages, thumbnails, outlines, text selection, document search, bookmarks, zoom, single/continuous layouts, printing copies, and editable annotations.
- **Pen and notebook tools:** Apple Pencil/other stylus pointer support, pressure-varying vector ink where available, optional finger drawing, touch pan/pinch handling in drawing mode, typed text, notes, rectangles, highlights, erasing your marks, undo/redo, local drafts, and extra blank pages.
- **Appearance:** Light, Dark, or System; System follows the device’s schedule. Document colors remain unchanged. Reduced-motion preferences are respected.
- **35 free document tools:** scan enhancement, perspective crop, shadow reduction, merge, split, extract, remove, reorder, duplicate, rotate, compress, repair, OCR, signatures, watermarks, numbering, forms, encryption, redaction, comparison, flattening, metadata, and format conversion.
- **Conversions:** PDF/images, JPG/PNG/WebP image conversion, text/Markdown extraction, DOCX paragraphs, inferred XLSX rows, PPTX page images, and basic Office/HTML/text reading copies.
- **OCR:** browser-local English, Persian, and Arabic recognition; plain text or searchable PDF output.
- **Layouts:** blank, lined, graph, letter, invoice, checklist, and genuine ID/passport-copy arrangements. No fabricated credentials.
- **Workspace:** browser-local saved files and drafts, individual/ZIP exports, device Files/share sheet, and used-tool offline caching.
- **Optional real integrations:** Firebase email/Google accounts, Google Drive Picker/direct uploads, and OneDrive MSAL/Graph import/export. They require owner-controlled project configuration and are clearly unavailable until configured. iCloud/Dropbox/other OS providers can be accessed through the device file picker where supported.
- **Public pages:** dedicated tool URLs and pre-rendered HTML, original guides, canonical/social metadata, sitemap, robots rules, structured data, creator attribution, and contributor resources.

## Go straight to a tool

[Merge PDF](https://plivvi.pages.dev/merge-pdf/) · [PDF reader](https://plivvi.pages.dev/pdf-reader/) · [Scan to PDF](https://plivvi.pages.dev/scan-to-pdf/) · [Compress PDF](https://plivvi.pages.dev/compress-pdf/) · [Persian OCR](https://plivvi.pages.dev/persian-ocr/) · [Free notebooks](https://plivvi.pages.dev/notebooks/)

[Practical guides](https://plivvi.pages.dev/guides/): private PDF preparation, scanning on iPhone/iPad, digital pen notes, and searchable Persian/Arabic scans. Each guide links directly to its tools and explains the relevant limits.

## Run it

Use **Node.js 24**.

```sh
npm ci
npm run dev
```

For a production build:

```sh
npm test
npm run build
node scripts/verify-build.mjs
npm run preview
```

Serve `dist` on an HTTPS static host. On iPhone/iPad: Safari → Share → Add to Home Screen. No Apple developer membership, signing profile, or App Store review is needed.

## No rented server required

The application is static. Cloudflare Pages is the recommended free production-host option for this project; GitHub Actions can test/build/deploy it. Its free `pages.dev` address is assigned by Cloudflare. No third-party domain or service can be guaranteed permanent forever.

The repository includes CI and an opt-in Cloudflare deployment workflow. Deployment is skipped until the owner adds the project name and required account secrets. A workflow file alone is not a deployed website.

[Hosting and Actions setup](docs/DEPLOYMENT.md) · [Account/cloud configuration](docs/ACCOUNTS-AND-CLOUD.md) · [Monetization and SEO](docs/MONETIZATION-AND-SEO.md) · [Launch plan and English/Persian post drafts](docs/LAUNCH-KIT.md)

## Privacy and offline use

Documents remain in browser memory until you download or explicitly save them. Saved outputs and drafts belong to the current browser and website origin; they do not synchronize automatically. Export important copies—browser data clearing, storage eviction, and private browsing can remove local work.

The app shell is cached after a successful production visit. Tool engines and OCR languages are cached as used. Load needed tools online, check offline readiness in Settings, and reopen the app before relying on offline use. Accounts and cloud transfers need an internet connection. The development server intentionally does not register the service worker.

Opening optional account/cloud interfaces can load provider SDKs. Cloud file contents transfer directly between the browser and the chosen provider only after the user requests it. Sponsorship content is first-party; there are no active ad-network scripts or behavioral trackers in the document workspace.

## Know the limits

This is an independent open-source workshop, not Adobe Acrobat, CamScanner, or iLovePDF. It does not claim complete parity with their proprietary services.

- Added text and annotations do not rewrite or reflow existing PDF paragraphs. The eraser removes marks created in the current reader or restored local draft; it does not erase arbitrary source text or imported annotations.
- Stylus pressure, coalesced input, browser palm behavior, and Files integration depend on the actual hardware/OS/browser. Pointer and export tests do not substitute for physical Apple Pencil testing.
- Shadow normalization cannot reconstruct obscured text, clipped glare, curved books, or blurred detail. Automatic corners are adjustable suggestions.
- OCR accuracy/reading order varies. Persian/Arabic recognition is available, but full bidirectional shaping is not implemented in every export path or annotation font.
- Office conversions are basic reading/editing copies. DOCX extracts paragraphs, XLSX infers rows, PPTX contains page images, and Office-to-PDF does not preserve full layout/charts. No certified PDF/A, certificate-backed digital signing, AI translation, cloud document synchronization, or generative summary service is included.
- Large documents can exceed browser memory, especially on iOS. Sources are capped at 100 MB each and PDFs at 300 pages; visual organization previews up to 60. These are browser resource guards, not paid limits.
- Lossless optimization may return the original if rewriting is larger. Raster compression loses interactive/searchable structure. PDF edits can invalidate existing cryptographic signatures.
- Crop changes the visible box; it is not redaction. Content redaction does not automatically sanitize attachments, every metadata field, or all other document structures.

## Search discovery

The production build generates **58 indexable pages**, including 45 tool/workflow pages, nine main pages and four practical guides. Each has static HTML, a distinct title and description, a canonical URL, social metadata and matching structured data. Private workspace/account routes are excluded and marked noindex.

`/sitemap-index.xml` lists the tools, pages and guides sitemaps. `/sitemap.xml` remains available for existing submissions. Run `node scripts/audit-live-seo.mjs` after deployment to check public HTTP responses. The optional Cloudflare workflow notifies IndexNow of changed public content; it does not submit private user data. See [search operations](docs/SEARCH-OPERATIONS.md). Submission is a discovery hint, not a guarantee of indexing or ranking.

## Tests and contribution

Tests cover page operations, password rejection, encrypted merges, real redaction, rotated/cropped coordinates, supported forms, Office containers, OCR text layers, scan geometry/lighting, offline cache exclusions, reader sessions/search, pressure-varying native ink, text wrapping, annotation flattening, and page creation. The build verifier checks every tool’s static HTML, metadata, sitemap presence, source download, callback isolation, and private-page indexing rules.

Live Firebase/Drive/OneDrive verification requires configured projects and provider test accounts. Do not claim those flows have been verified solely because compilation passes. Physical camera/stylus/installation behavior needs real-device testing.

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). AI-assisted contributions are welcome when reviewed and tested. Use synthetic fixtures and never commit private documents or credentials.

## Source and licenses

AGPL-3.0-or-later. MuPDF uses its AGPL licensing option. About/source links provide the corresponding application source, and `scripts/prepare-source.mjs` generates `public/source.zip` with build instructions and dependency references. Dependencies, Git history, runtime files, private environment files, and test exports are excluded.

[Third-party notices](public/THIRD-PARTY-NOTICES.txt) · [Feature research](FEATURE-RESEARCH.md)

Made by **[Ramtin Neshatvar](https://github.com/ramt11n)** · [LinkedIn](https://linkedin.com/in/ramtin-neshatvar-185534263) · [CV](https://ramtin-neshatvar-cv.asa-adv-agency2.chatgpt.site) · [plivvi.pages@gmail.com](mailto:plivvi.pages@gmail.com)

## Accounts, workspaces, and deployment readiness

The account UI supports email signup/login, Google sign-in, verification, password reset, multiple signed-in accounts, and an explicit guest workspace. Account libraries and reader drafts are kept separate on this browser; signing in does not automatically upload or sync files.

A deployment must have real Firebase and provider configuration before online sign-in, Google Drive, or OneDrive can work. Unconfigured services are labeled in the UI. See [accounts and cloud setup](docs/ACCOUNTS-AND-CLOUD.md). Type checking and mocked/isolated unit tests do not establish live OAuth correctness. Test the configured public origin with real test accounts before calling those services operational.

The revised visual identity includes local Sora/Manrope typography and an original stylus feature showcase. See [design and asset provenance](docs/DESIGN.md).

## Notebooks and languages

Create named notebooks with colored covers and blank, ruled, dotted, grid, or Cornell paper. Pages and editable ink autosave per account workspace in this browser. Add photographs, text, highlights, and pressure/tilt-aware pen strokes; duplicate and reorder pages. Export PDF or page images. Local notebooks are not a server backup or automatic cross-device sync.

Text-to-PDF and Office reading-copy conversion use MuPDF Unicode shaping with locally hosted Noto script fonts and built-in CJK fallback. Persian/Arabic direction is detected per paragraph. Common Indic scripts and extended Latin characters are supported. Fonts download only when their script is needed and can then be cached offline. The app does not upload text to a font service. Original Office pagination/design is not reproduced. OCR currently provides English, Persian and Arabic models.

Plivvi is an invented name, pronounced **PLIV-ee**. Its logo, type, cobalt/mint colors, and paper illustrations form the app's visual identity.

## Plivvi 3.2

Optional crypto support is now available at [plivvi.pages.dev/support](https://plivvi.pages.dev/support/): 14 owner-supplied receiving routes, including USDT on five networks. The site does not connect to wallets or process payments. Every document feature stays free.

Ten focused workflow URLs open real presets for JPG/PNG, Word, Excel, PowerPoint, Persian/Arabic OCR, and Apple Pencil annotation. Together with the core tool guides, Plivvi generates 53 indexable pages. Document and account workspaces remain excluded from indexing.

The pen workspace includes a first-visit gesture guide and a toolbar help button. Two-finger translation and pinch share one page anchor, with absolute per-frame scale updates. Automated pointer tests do not replace testing on a physical iPad.

[Donation configuration and research](docs/DONATIONS.md) · [Shareable launch copy](docs/SHARE-PLIVVI.md)
