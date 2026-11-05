# Plivvi: a focused, free launch plan

## What to lead with

**Your PDF, your device. Every tool free.**

Lead with a task someone needs today, rather than a list of 35 features. The strongest first demonstrations are:

1. **Merge and sign a PDF without a document upload.** Show two synthetic PDFs becoming one finished file. Link directly to https://plivvi.pages.dev/merge-pdf/ and the [private workflow guide](https://plivvi.pages.dev/guides/private-pdf-workflow/).
2. **Turn a phone photo into a clean PDF.** Show the original, crop corners and enhanced result. Link to https://plivvi.pages.dev/scan-to-pdf/. Demonstrate on a real phone; avoid claiming an illustration is a camera test.
3. **Make a Persian scan searchable.** Show a real, public-domain printed sample and a successful search in the exported PDF. Link to https://plivvi.pages.dev/persian-ocr/. Review the recognized text first. Do not promise perfect recognition or a layout-preserving Word conversion.

Keep the mascot as a memorable accent. The useful before/after result should occupy most of a demo. A 15–25 second screen recording with readable captions is a good starting experiment. Use actual Plivvi screens and synthetic/public documents.

## First two weeks

This is an experiment, not a traffic or revenue forecast.

- **Before sharing:** verify the three workflows on target devices, the final public links, guest access and export. Keep a short list of reproducible bugs. Complete the free Product Hunt account setup only if choosing that channel.
- **First wave:** post one personal maker introduction on your own LinkedIn or Telegram channel, with one task and one direct tool link. Ask a small group of willing testers to complete a task and describe where they got stuck. Do not ask for positive reviews or coordinated votes.
- **Second wave:** publish two different before/after demonstrations. One can explain Persian OCR in Persian. Share with a relevant student/productivity community only when its rules allow maker posts; disclose that you made the app and participate in replies.
- **After feedback:** fix the most common failure before widening promotion. A successful export is more useful than a large number of empty visits.
- **Broader launch:** consider one Show HN or Product Hunt launch when the core workflows are reliable and you can answer questions. Do not submit the same release repeatedly. Show HN expects a working project people can try, not a fundraiser or a generic landing page.

## Ready-to-use copy

These are drafts. They have not been posted or sent to third-party communities.

### Personal LinkedIn / English maker post

I built Plivvi because small document tasks should not require another subscription.

You can merge, scan, sign and read PDFs for free. Document processing runs in your browser, and you can try the tools without an account. The source is public too.

A useful place to start: combine a few PDFs into one file → https://plivvi.pages.dev/merge-pdf/

I'm looking for practical feedback: which step saves you time, and which step still gets in your way?

Source: https://github.com/ramt11n/plivvi

### Persian Telegram / student-community draft

برای چند تا کار ساده با PDF نباید اشتراک تازه خرید.

Plivvi رو ساختم تا ادغام، اسکن، امضا و خواندن فایل‌ها رایگان باشه. پردازش سند توی مرورگر خودتون انجام می‌شه و برای استفاده از ابزارها ثبت‌نام لازم نیست. کد پروژه هم بازه.

برای شروع، چند PDF رو یکی کنید:
https://plivvi.pages.dev/merge-pdf/

برای اسکن‌های فارسی هم OCR داریم؛ نتیجهٔ تشخیص متن رو قبل از استفاده بررسی کنید:
https://plivvi.pages.dev/persian-ocr/

اگر جایی گیر کردید، از «Report a bug» داخل سایت بهم خبر بدید. خودم سازندهٔ پروژه‌ام و بازخورد واقعی خیلی کمک می‌کنه.

### Show HN draft

**Title:** Show HN: Plivvi — free PDF tools that process documents in your browser

I built Plivvi to make everyday document tasks available without a feature subscription or required account. It is a static PWA with browser-local PDF/image processing, scanning, annotations and digital notebooks.

Try it: https://plivvi.pages.dev/
Source: https://github.com/ramt11n/plivvi

AI-assisted development was part of the build. I'm responsible for testing and fixes. The repository documents the limits: Office conversion is basic, OCR can make mistakes, and large PDFs can exceed mobile-browser memory. Optional cloud transfers are user initiated; local workspaces are not automatic cloud sync.

I'd appreciate feedback on completing a real task, particularly mobile scanning and PDF annotation. Please use synthetic samples for public bug reports.

Before posting, add one concrete implementation decision you can explain in your own words and be available to answer questions. Check the current community rules and submit only when you are comfortable demonstrating the app.

### Product Hunt draft

**Name:** Plivvi

**Tagline:** Free PDF tools. Your documents stay on your device.

**Description:** Read, scan, sign, merge and convert documents in your browser. Free tools, digital notebooks, no required account, and open-source code. Optional cloud connections are your choice.

**Maker comment:**

Hi, I'm Ramtin. I built Plivvi to make the small jobs around documents less frustrating. The document tools are free, and the main workflow does not require a document-processing server or a user account.

Try merging a PDF, cleaning up a phone scan or opening a notebook. I'd love to hear which workflow you use and where the app needs improvement. The source and known limits are public on GitHub.

**Gallery:** use the real homepage, scan before/after, reader and notebook screens. Use the app icon as the thumbnail. Device illustrations can support the gallery, but should not replace working product screenshots.

## A conversion path that respects the user

A useful demo → the exact tool → an export that works → a reason to return.

- Link to the tool, not a donation page or forced signup.
- Keep optional support after a successful task, with a clear dismissal. Do not block exports behind a donation request.
- Ask for one specific bug or workflow suggestion. Do not collect visitors' private documents for promotion.
- Publish helpful fixes and examples in the repository. Add original guides when a recurring question deserves one.

## What to measure

Start with aggregate hosting request trends, Search Console impressions/clicks once available, voluntary bug reports and reproducible task success. Hosting requests include bots and are not a count of real users. Do not report invented monthly users or conversion rates.

For ten willing testers, record only: task, device/browser, completed export (yes/no), and the obstacle. Avoid private file contents or identifying details. Use that feedback to choose the next fix. A practical launch-readiness check is that most testers can finish the demonstrated task without help; it is not a statistical guarantee.

## Search expectations and the next check

The build provides 58 pre-rendered public URLs, matching canonical metadata, internal tool/guide links, XML sitemaps, a crawlable favicon and private-page exclusions. Run `node scripts/audit-live-seo.mjs` after deployment. Follow [search operations](SEARCH-OPERATIONS.md).

On 5 November 2026, Google's homepage live test passed, while its sitemap report still showed “Couldn't fetch.” The manual indexing quota was already exhausted. The sitemap submissions were accepted, but that does not prove Google fetched or indexed them. Recheck Search Console after it processes the submissions and investigate any specific fetch error it exposes. Do not repeatedly resubmit an unchanged sitemap or attempt to bypass the quota.

Google describes crawling as taking a few days to a few weeks, with no inclusion guarantee. Useful content, working tools and relevant genuine links matter more than repeated submission. Target long-tail tasks such as Persian OCR and on-device PDF merging before competing for a broad phrase like “PDF tools.”

## Official references

- [Google: ask for recrawling](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- [Google: troubleshoot crawling errors](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors)
- [Show HN guidelines](https://news.ycombinator.com/showhn.html)
- [Product Hunt launch guide](https://help.producthunt.com/en/articles/17350772-launch-guide)
- [Product Hunt launch FAQ](https://help.producthunt.com/en/articles/17734646-8-launch-faq-and-myths)
