# Practical conversion in Plivvi 3.9

The file converter runs locally in a dedicated, cancellable worker. It shares the existing navy, cobalt, mint and lavender interface and does not require an account. Original files are retained unchanged. The home page and sortable tool directory link to the converter; existing PDF/image/Office converter routes open the same workspace with the appropriate output preset.

## Workflows

- Select pages with ranges such as `1-2,5`, reverse the range, and reorder source files.
- Export one image per page, or join selected pages vertically or horizontally.
- Set output width and quality, rotate pages, and trim their edges. Image results can open the existing crop/enhancement editor; that editor makes a still JPG copy up to 1800 pixels.
- Download files individually or in a ZIP, save them to the existing workspace, open PDFs in the reader, or choose an optional cloud destination.
- Convert exported files again, including the reverse direction when supported.
- Create vector paths, shapes and text in SVG Studio; edit, copy and download the SVG code. Imported studio code is sanitized and strips interactive content and external resources.

## Capability boundaries

Outputs: PDF, JPG/JPEG, PNG, WebP, AVIF, HEIC, TIFF, BMP, GIF, ICO, SVG, TXT, Markdown, HTML, DOCX, XLSX, PPTX, CBZ and EPUB.

Inputs: those formats, HEIF, PSD, QOI, modern Office and OpenDocument documents, CSV/TSV/JSON/XML, CBR/RAR comics and FB2. Legacy DOC/XLS/PPT are not advertised as supported. CBR is read-only; CBZ is the editable/exportable comic archive counterpart. GIF, TIFF and other multi-frame sources are treated as pages, not animated outputs.

PDF-to-SVG preserves the PDF's drawing commands; embedded photos stay images. Photo-to-SVG traces colored paths and changes detail. Text extraction cannot recover text from image-only scans; OCR is a separate local tool. DOCX/XLSX/ODF imports are text/data reading copies, and do not reproduce complex Office layouts. PPTX imports preserve embedded pictures and positioned text as a reading copy, without full Office theme, chart, group, effect or animation fidelity. PDF-to-Word extracts paragraphs, PDF-to-Excel infers rows, and PDF-to-PowerPoint makes page-image slides. Converting a PDF also does not preserve every interactive PDF feature or accessibility tag.

SVG input is sanitized and converted to vector PDF commands locally with svg2pdf.js/jsPDF before the worker renders or exports it. External resources are blocked. Custom fonts, filters and advanced SVG effects need visual review. Editable SVG inputs are capped at 32 MiB. PSD conversion uses its flattened composite; GIF/TIFF frames remain separate pages. The installed MuPDF WASM build has no XPS/OpenXPS handler, so those extensions are not offered as supported inputs.

## Large files

PDFs use MuPDF random-access streams over worker-side `FileReaderSync` and `File.slice`. A whole large source is not eagerly copied into an ArrayBuffer. Initial PDF previews render only six pages in the converter, or twelve in ordinary tools; form widgets are scanned only by the form tool. Local reader imports use the same file-backed input and incremental SHA-256 hashing so existing annotation draft keys remain compatible.

The browser still has finite decoded-image, WASM and output memory. Images are limited to 40 million input pixels; joined exports to 32 million pixels and 32768 pixels per dimension. Non-streamed batches retain at most 256 MiB of results; use direct disk saving for more. Non-streamed CBZ creation is capped at 192 MiB of page images; direct CBZ saving streams pages instead. Office/image source reads are capped at 512 MiB per file in the converter.

Direct saving writes ZIP entries sequentially to a native file picker, or to origin-private browser storage followed by a download in browsers without the picker. Worker output acknowledgements apply backpressure between pages. A direct CBZ export writes the same page archive with a `.cbz` extension. Cancelling stops only the conversion worker; an open reader's session is retained.

The browser regression fixture is a valid PDF greater than 1 GiB, containing two renderable pages and a large unused stream. It tests random-access file size handling, not the ability to process arbitrarily complex gigabyte documents on every device. No unlimited file-size or all-format claim is made.

## HEIC isolation

HEIC input uses ImageMagick. Real HEIC output uses icodec's libheif/x265 encoder in a separate same-origin window with COOP/COEP headers. BroadcastChannel transfers the PNG pixels and receives encoded HEIC bytes. Only the codec window and its encoder workers are isolated; Microsoft and Google sign-in callbacks retain their existing policies. HEIC decoding of the exported file is tested in Brave.

## Reproduction and checks

Run `npm test`, `npm run build`, and `node scripts/verify-build.mjs`. Start `npm run preview -- --port 4174`, then run `npm run test:browser`. The browser configuration uses installed Brave by default; `PLIVVI_BROWSER` accepts another Chromium executable and `PLIVVI_TEST_URL` selects a preview origin. Browser fixtures and exported artifacts stay under ignored test/temp paths. The test suite exercises built worker assets, UI downloads, actual image encoders, Office/comic reverse conversions, SVG drawing, real OCR, malformed input, direct ZIP output and the greater-than-1-GiB PDF.

The reported short-PDF crash was not reproduced with the supplied public sample in fresh Brave, either locally or on production. Its exact file was not provided. The old error came from Worker.onerror; worker recovery and accurate retry messages replace the misleading blanket instruction to use a smaller file.

Workflow research: [iLovePDF PDF-to-JPG](https://www.ilovepdf.com/pdf_to_jpg), [iLoveIMG image conversion](https://www.iloveimg.com/convert-to-jpg), [MuPDF JavaScript](https://mupdf.readthedocs.io/en/latest/reference/javascript/index.html), [magick-wasm](https://github.com/dlemstra/magick-wasm), and [icodec](https://github.com/Kaciras/icodec). The interface and implementation are Plivvi's own.
