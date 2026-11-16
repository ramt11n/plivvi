# Converter components and source

Plivvi remains AGPL-3.0-or-later. Its source archive includes the application, lockfile, worker code, build configuration and browser tests. The lockfile records the exact npm package artifacts; install with `npm ci`.

New conversion dependencies:

| Component                     | Package version | License                                                          | Source                                           |
| ----------------------------- | --------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| magick-wasm                   | 0.0.46          | Apache-2.0 wrapper; bundled native codecs have their own notices | https://github.com/dlemstra/magick-wasm          |
| icodec                        | 0.6.0           | MIT wrapper; native codecs retain their licenses                 | https://github.com/Kaciras/icodec                |
| ImageTracerJS                 | 1.2.6           | Unlicense                                                        | https://github.com/jankovicsandras/imagetracerjs |
| noble-hashes                  | 2.4.0           | MIT                                                              | https://github.com/paulmillr/noble-hashes        |
| Playwright (development only) | 1.65.1          | Apache-2.0                                                       | https://github.com/microsoft/playwright          |

icodec's HEIC build identifies libheif v1.19.1, x265 4.0 and libde265 v1.0.15 in its distributed `versions.json`. Source/build instructions and native license notices are maintained in those upstream projects: [libheif](https://github.com/strukturag/libheif/tree/v1.19.1), [x265](https://bitbucket.org/multicoreware/x265_git/src/4.0/), and [libde265](https://github.com/strukturag/libde265/tree/v1.0.15). The HEIC encoder is used locally, without a hosted conversion service. Codec patent/licensing obligations may differ by distribution and jurisdiction; this document records component provenance and is not an assertion of universal licensing clearance.

Existing MuPDF, pdf-lib, Tesseract, libarchive, fflate, docx, ExcelJS and PptxGenJS retain their upstream licenses. Their exact npm versions and integrity hashes are recorded in `package-lock.json`.
