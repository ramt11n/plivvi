# Pocket PDF Workshop — feature research

Researched 1 November 2026. This is a product and implementation map, not a claim that every listed capability is implemented. Browser-local feasibility assessments below are engineering judgments informed by the cited library documentation.

## Reference products

The supplied [CamScanner App Store listing](https://apps.apple.com/us/app/camscanner-pdf-scanner-app/id1543833156?mt=12) is **Mac-only** and emphasizes screenshot/image OCR, including handwriting and vertical text. It is not a complete specification of the iPhone scanning app.

[CamScanner's official site](https://www.camscanner.com/) provides the broader product reference: multipage, book, ID, exam, whiteboard and slide scanning; automatic cropping and perspective correction; enhancement; OCR; annotation/signature/watermark; page organization and PDF/Office/image conversion; document sync; and additional AI utilities. Its enhancement marketing includes shadows, glare, finger occlusion, creases/stains, bleed-through and screen moiré. These are vendor claims, not independently verified quality benchmarks. Do not describe a simple brightness filter as equivalent to those proprietary AI features.

[CamScanner's FAQ](https://www.camscanner.com/faq?category=create-save) describes combining receipt/invoice/ID-front-and-back images into one PDF page with selectable collage layouts. Its [official ID-document guide](https://blog.camscanner.com/2026/09/04/how-to-scan-organize-and-find-passport-visa-id-documents-with-camscanner/) discusses front/back ID capture and passport/visa document organization. Apple's [CamScanner feature story](https://apps.apple.com/us/iphone/story/id1631951998) separately documents passport/visa photo presets, greeting-card layouts, book-spread splitting and cloud access. A scan layout and a government-issued form are different things: use neutral copy layouts, or user-imported official forms, and never promise government acceptance.

[iLovePDF's current official catalog](https://www.ilovepdf.com/) includes: merge; split; remove/extract/organize pages; scan; compress; repair; OCR; image, Office, HTML and PDF/A conversions; rotation; page numbers; watermark; crop; added-content editing; forms; unlock/protect; signing; redaction; comparison; AI summary/translation; Markdown export; reusable workflows. This catalog is the completeness reference below; matching its full backend, conversion and AI service stack is outside a small static PWA.

## Practical browser-local feature matrix

| Feature family | Local implementation path | Exact scope / limits |
|---|---|---|
| Camera scan + import | Camera permission, file picker, drag/drop, batch image import | HTTPS required for live camera. With no camera, importing files remains fully usable. Provide permission-denied and unsupported-camera fallbacks. |
| Crop / straighten / perspective | Four draggable corners, geometric warp; optional edge proposal | Manual corners must remain available. Automatic contour detection can miss white-on-white, curled or occluded pages. |
| Filters | Original, color enhancement, grayscale, adaptive B&W, brightness/contrast | Preserve original pixels and preview changes. Never discard originals before explicit removal. |
| Shadow reduction | Low-resolution illumination estimate followed by local normalization; strength slider | Effective on uneven lighting; cannot recover clipped glare, severely blurred text, hidden content or finger-covered text. Label “shadow reduction”, not AI reconstruction. |
| Scan modes / templates | A4, Letter, A5, original image; receipt; ID front/back; passport-copy; two-up | These arrange authentic user images. Add margins, fit/fill preview and optional purpose watermark. Passport-photo compliance and jurisdiction-specific forms need maintained requirements. |
| Merge / split / page organization | pdf-lib or MuPDF page copying and rearrangement | Preserve vectors/text when possible; implement ranges, extraction, deletion, duplication, rotation and mobile move buttons as well as drag/drop. |
| PDF ⇄ images | PDF renderer + PNG/JPEG/WebP encoding; images embedded in PDF | PDF-to-image rasterizes pages. Transparent PNG needs an explicit background choice for JPEG. Export multiple images as ZIP. |
| Text / Markdown export | Extract digital PDF text; OCR images/scans as needed | Reading order and tables vary. Text extraction is not a faithful Word conversion. |
| Compression | Clean/garbage-collect native PDF; optional downsampled image reconstruction | Offer clear lossless/standard/strong choices. Raster reconstruction loses searchable text, interactive forms, links and vector quality unless deliberately restored. Smaller output is not guaranteed. |
| Added text / highlight / pen / watermark / page numbers | PDF annotation or drawing APIs | Adding content is achievable. Editing arbitrary existing PDF paragraphs is a much larger layout problem. |
| Drawn / uploaded signatures | Pointer canvas or transparent signature image placed on page | A visual electronic signature. It does not supply identity verification, cryptographic integrity or trusted timestamping. |
| AcroForm fill / flatten | Read widget/form fields and write values; optional flatten | Existing standard forms are realistic. Arbitrary automatic field discovery, XFA and complex scripts need separate support and tests. |
| Protect / unlock | MuPDF AES password encryption; authenticate known password before decrypting | Does not recover a forgotten open password. pdf-lib alone does not implement encryption. Keep passwords out of logs and persistent storage. |
| True redaction | Apply MuPDF Redaction annotations, then rewrite/garbage-collect | Must remove underlying text/image content; a black rectangle alone is insecure. Reopen export, search/extract text and inspect images to verify removal. Check attachments/metadata separately. |
| Compare | Side-by-side previews and rendered visual difference | Pixel differences show rendering changes, not necessarily semantic changes. |
| OCR | Lazy-loaded Tesseract.js worker; PDF rendered one page at a time | Language packs require initial download. Accuracy depends on script/font/quality; Persian/Arabic need dedicated testing. Searchable-PDF export requires a correctly positioned invisible Unicode text layer. |
| PDF to Word / Excel / PowerPoint | Dedicated document-layout/conversion engine | Text-only DOCX, CSV from manual tables, or slides containing page images are possible, but must be named accordingly. Do not claim editable high-fidelity conversion without such an engine. |
| Office to PDF | Office rendering engine or explicit browser print workflow | Browser-only libraries do not reliably reproduce arbitrary DOCX/XLSX/PPTX pagination, fonts and charts. Preserve a clearly labeled advanced-service boundary. |
| HTML to PDF | User-supplied HTML or browser print for the current page | Arbitrary remote URLs face CORS, authentication and rendering limitations. Do not promise a generic URL converter from static client code. |
| Repair | Reparse/rewrite salvageable PDFs with MuPDF | Show parsing errors; unrecoverable missing bytes cannot be recreated. Never guarantee repair. |
| PDF/A | Standards-aware conversion plus independent conformance validation | Adding “PDF/A” metadata or changing an extension is insufficient. Keep unavailable until validated output is implemented. |
| Digital certificate signatures | PKCS#12/private-key signing, trust chain, byte ranges, verification; optional timestamp service | Separate from drawn signatures. Some MuPDF signature methods are only available in mutool, not npm WASM. Do not promise certificate signing from a visual signing feature. |
| AI summary / translation / semantic reconstruction | Optional local model or explicit opt-in external service | Not needed for private core. Avoid fake AI labels or sending documents to external services silently. |
| Local library / offline use | IndexedDB blobs + metadata, service worker app shell, export/backup | Browsers can evict local data. “Saved in this browser” and export backup must be clear; cross-device access does not imply automatic sync. |

## Primary implementation references

- [pdf-lib](https://pdf-lib.js.org/) supports browser PDF creation, page merge/split, drawing and forms. Its [documented limitations](https://github.com/Hopding/pdf-lib#limitations) include no arbitrary page-text editing and no encrypted-document support. `ignoreEncryption: true` does not decrypt a PDF.
- [MuPDF JavaScript guide](https://mupdf.readthedocs.io/en/latest/guide/using-with-javascript.html) describes browser/Node WebAssembly. [Document APIs](https://mupdf.readthedocs.io/en/latest/reference/javascript/types/Document.html) expose `needsPassword()`, `authenticatePassword()` and page loading. [PDF save options](https://mupdf.readthedocs.io/en/latest/reference/common/pdf-write-options.html) support `encrypt=aes-256`, `user-password`, `owner-password`, `encrypt=none`, compression and garbage collection.
- [MuPDF PDFPage](https://mupdf.readthedocs.io/en/latest/reference/javascript/types/PDFPage.html) supports widget enumeration, annotation creation and destructive `applyRedactions()`. [Widget APIs](https://mupdf.readthedocs.io/en/latest/reference/javascript/types/PDFWidget.html) support text/choice values and checkbox toggling. [PDFDocument](https://mupdf.readthedocs.io/en/latest/reference/javascript/types/PDFDocument.html) provides `saveToBuffer(options)`.
- [MuPDF Pixmap](https://mupdf.readthedocs.io/en/latest/reference/javascript/types/Pixmap.html) supports PNG/JPEG output and explicit quadrilateral warping. `detectDocument`, `autowarp`, and `deskew` are marked mutool-only in current docs; verify the installed package instead of assuming browser availability. OCR is not exposed on this documented Pixmap JS API.
- [MuPDF licensing](https://mupdf.readthedocs.io/en/latest/license.html) offers AGPL or commercial licensing. A distributed free PWA should preserve licenses and provide the corresponding source under applicable terms.
- [PDF.js](https://mozilla.github.io/pdf.js/) is an alternative browser parsing/rendering engine. [Tesseract.js](https://github.com/naptha/tesseract.js) runs OCR with WebAssembly, but does not accept PDFs directly; render them first.
- [OpenCV.js perspective transforms](https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html) and [adaptive thresholding](https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html) provide scanning primitives; adaptive thresholds handle varying local illumination.
- [Camera API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) requires a secure origin and user permission. [PWA offline guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) explains service-worker caching. [Storage guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) documents quota and eviction, so local persistence needs error handling and export backup.
- [iLovePDF PDF/A](https://www.ilovepdf.com/convert-pdf-to-pdfa) distinguishes conformance levels with font/color/metadata and structure requirements. [veraPDF](https://docs.verapdf.org/validation/) provides independent PDF/A validation profiles.
- [iLovePDF signing](https://www.ilovepdf.com/sign-pdf) distinguishes simple signatures from its premium certificate/timestamp service. Its service claims are not capabilities supplied by merely embedding a signature image.

## Implementation priorities

1. Ship a complete local path: import/capture → clean scan → arrange pages → sign/annotate → export. Make every visible control produce its advertised output.
2. Lazy-load rendering, WASM, OCR and format engines after selection; work one page at a time with progress, cancellation and explicit memory caps. Cache heavy engines/language packs separately from the small shell.
3. Keep original page bytes plus reversible edit parameters; generate output from those parameters so preview/export match.
4. Add standards-aware advanced capabilities only when executable and tested. Keep the catalog honest: functional alternatives are preferable to disabled cards implying parity.
5. Validate document semantics, not only screenshots: page count/order, dimensions, extracted text, password rejection/acceptance, redacted content absence, saved form values and raster quality. Test responsive UI separately at phone/tablet/desktop sizes.

## MuPDF implementation sketches

These are patterns from current documented APIs, not a substitute for checking installed version/types. MuPDF page coordinates are upper-left origin, y down. Use native page bounds for mapping pointer coordinates.

```js
const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
if (doc.needsPassword() && !doc.authenticatePassword(password)) {
  throw new Error('Incorrect password');
}
const pdf = doc.asPDF();
const clearBytes = pdf.saveToBuffer('encrypt=none,garbage=compact,compress=yes');
// Convert returned buffer using its asUint8Array() API.
```

```js
const page = pdf.loadPage(pageIndex);
const mark = page.createAnnotation('Redaction');
mark.setRect([x0, y0, x1, y1]);
page.applyRedactions(true,
  mupdf.PDFPage.REDACT_IMAGE_PIXELS,
  mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_TOUCHED,
  mupdf.PDFPage.REDACT_TEXT_REMOVE);
const result = pdf.saveToBuffer('garbage=compact,compress=yes');
```

Do a full rewrite for redaction, preserve the source separately, and verify the exported result. Garbage collection discards unreachable content; it does not guarantee that all metadata and embedded attachments have been sanitized. Save-option password strings require correct escaping or validated input because commas and equals are option delimiters.
