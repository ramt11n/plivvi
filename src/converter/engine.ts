import type { Input, Output } from '../lib/client';
import { mu, open, operate } from '../lib/engine';
import { inputData, inputSize, inputStream } from '../lib/input';
import { selectedPages, escapeHTML } from '../lib/catalog';
import {
  extension,
  isRaster,
  officeExtensions,
  textExtensions,
  outputFormats,
  type ConvertOptions,
  type Inspection,
} from './formats';
import { encodeRaster, rasterFrames, joinRaster } from './codecs';
type Document = import('mupdf').Document;
type Progress = (label: string, percent?: number) => void;
type Emit = (output: Output) => void | Promise<void>;
const stem = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
const utf8 = (value: string) => new TextEncoder().encode(value);

async function genericDocument(input: Input, magic: string) {
  const m = await mu(),
    stream = inputStream(m, input);
  try {
    return m.Document.openDocument(stream ?? (await inputData(input)), magic);
  } finally {
    stream?.destroy();
  }
}
async function loadDocument(input: Input, password = ''): Promise<Document> {
  const ext = extension(input.name),
    m = await mu();
  if (ext === 'pdf' || input.type === 'application/pdf') return open(input, password);
  if (officeExtensions.includes(ext) || textExtensions.includes(ext)) {
    let source = input;
    if (['odt', 'ods', 'odp'].includes(ext)) {
      const { unzipSync } = await import('fflate');
      const parts = unzipSync(new Uint8Array(await inputData(input)), {
        filter: (entry) => entry.name === 'content.xml' && entry.originalSize < 128 * 1024 * 1024,
      });
      if (!parts['content.xml']) throw Error('The OpenDocument file has no readable content.xml.');
      const text = new TextDecoder()
        .decode(parts['content.xml'])
        .replace(/<\/(?:text:p|text:h|table:table-row)>/g, '\n')
        .replace(/<[^>]*>/g, '')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>');
      source = { name: stem(input.name) + '.txt', data: utf8(text).buffer, type: 'text/plain' };
    } else if (textExtensions.includes(ext) && !['txt', 'md', 'html', 'htm'].includes(ext)) {
      source = {
        ...input,
        name: stem(input.name) + '.txt',
        data: await inputData(input),
        file: undefined,
      };
    }
    const [pdf] = await operate(
      officeExtensions.includes(extension(source.name)) ? 'office-pdf' : 'html-pdf',
      [source],
    );
    return open({ name: pdf.name, type: pdf.type, data: pdf.data.buffer as ArrayBuffer });
  }
  if (['cbr', 'rar'].includes(ext)) {
    const { comicPDF } = await import('../reader/comic');
    const pdf = await comicPDF({ ...input, data: await inputData(input) }, () => {});
    return open(pdf);
  }
  if (isRaster(input.name)) {
    const frames = await rasterFrames(new Uint8Array(await inputData(input)));
    const buffer = new m.Buffer(),
      writer = new m.DocumentWriter(buffer, 'pdf', 'compress=yes');
    try {
      for (const frame of frames) {
        const document = m.Document.openDocument(frame, 'image/png');
        const page = document.loadPage(0),
          device = writer.beginPage(page.getBounds());
        try {
          page.run(device, m.Matrix.identity);
          device.close();
        } finally {
          device.destroy();
          page.destroy();
          document.destroy();
        }
        writer.endPage();
      }
      writer.close();
      return new m.PDFDocument(new Uint8Array(buffer.asUint8Array()));
    } finally {
      writer.destroy();
      buffer.destroy();
    }
  }
  const mime: Record<string, string> = {
    cbz: 'application/vnd.comicbook+zip',
    epub: 'application/epub+zip',
    fb2: 'fb2',
  };
  if (!mime[ext])
    throw Error('This file type has no local converter yet. Choose one of the listed formats.');
  return genericDocument(input, mime[ext]);
}

function pageGeometry(
  m: Awaited<ReturnType<typeof mu>>,
  page: import('mupdf').Page,
  options: ConvertOptions,
) {
  const b = page.getBounds(),
    crop = Math.max(0, Math.min(40, Number(options.crop ?? 0))) / 100;
  const x = b[0] + (b[2] - b[0]) * crop,
    y = b[1] + (b[3] - b[1]) * crop;
  const width = (b[2] - b[0]) * (1 - 2 * crop),
    height = (b[3] - b[1]) * (1 - 2 * crop);
  let matrix = m.Matrix.concat(
    m.Matrix.translate(-x, -y),
    m.Matrix.rotate(Number(options.rotation ?? 0)),
  );
  const rotated = m.Rect.transform(
    [0, 0, width, height],
    m.Matrix.rotate(Number(options.rotation ?? 0)),
  );
  matrix = m.Matrix.concat(matrix, m.Matrix.translate(-rotated[0], -rotated[1]));
  let bounds: import('mupdf').Rect = [0, 0, rotated[2] - rotated[0], rotated[3] - rotated[1]];
  if (options.target === 'pdf' && options.paper && options.paper !== 'original') {
    const [w, h] = options.paper === 'a4' ? [595.28, 841.89] : [612, 792];
    const scale = Math.min((w - 36) / bounds[2], (h - 36) / bounds[3]);
    matrix = m.Matrix.concat(matrix, m.Matrix.scale(scale, scale));
    matrix = m.Matrix.concat(
      matrix,
      m.Matrix.translate((w - bounds[2] * scale) / 2, (h - bounds[3] * scale) / 2),
    );
    bounds = [0, 0, w, h];
  }
  return { matrix, bounds };
}
async function writePages(
  doc: Document,
  indices: number[],
  format: 'svg' | 'pdf',
  options: ConvertOptions,
) {
  const m = await mu(),
    buffer = new m.Buffer();
  const writer = new m.DocumentWriter(buffer, format, format === 'pdf' ? 'compress=yes' : '');
  try {
    for (const index of indices) {
      const page = doc.loadPage(index),
        geometry = pageGeometry(m, page, options);
      const device = writer.beginPage(geometry.bounds);
      try {
        page.run(device, geometry.matrix);
        device.close();
      } finally {
        device.destroy();
        page.destroy();
      }
      writer.endPage();
    }
    writer.close();
    return new Uint8Array(buffer.asUint8Array());
  } finally {
    writer.destroy();
    buffer.destroy();
  }
}
async function pagePNG(doc: Document, index: number, options: ConvertOptions, jpeg = false) {
  const m = await mu(),
    page = doc.loadPage(index);
  try {
    const { bounds, matrix } = pageGeometry(m, page, options);
    if (!bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0)
      throw Error('This page has invalid dimensions and cannot be rendered.');
    let scale = Math.min(
      Math.max(64, Number(options.resolution || 1500)) / bounds[2],
      32768 / bounds[3],
    );
    scale = Math.min(scale, Math.sqrt(32_000_000 / (bounds[2] * bounds[3])));
    const scaled = m.Matrix.concat(matrix, m.Matrix.scale(scale, scale));
    const pix = new m.Pixmap(
      m.ColorSpace.DeviceRGB,
      [0, 0, Math.ceil(bounds[2] * scale), Math.ceil(bounds[3] * scale)],
      false,
    );
    pix.clear(255);
    const device = new m.DrawDevice(scaled, pix);
    try {
      page.run(device, m.Matrix.identity);
      device.close();
      const bytes = jpeg
        ? pix.asJPEG(Math.max(1, Math.min(100, Number(options.quality ?? 90))))
        : pix.asPNG();
      return new Uint8Array(bytes);
    } finally {
      device.destroy();
      pix.destroy();
    }
  } finally {
    page.destroy();
  }
}
export async function inspectConversion(input: Input, password = ''): Promise<Inspection> {
  const document = await loadDocument(input, password);
  try {
    const pages = document.countPages();
    if (!pages) throw Error('This document has no pages.');
    const first = document.loadPage(0);
    let width: number, height: number;
    try {
      const b = first.getBounds();
      width = b[2] - b[0];
      height = b[3] - b[1];
    } finally {
      first.destroy();
    }
    const thumbnails = [];
    for (let index = 0; index < Math.min(6, pages); index++)
      thumbnails.push({
        index,
        data: await pagePNG(document, index, { target: 'png', resolution: 200 }),
      });
    return {
      name: input.name,
      pages,
      width,
      height,
      bytes: inputSize(input),
      thumbnails,
      note: officeExtensions.includes(extension(input.name)) ? 'Text and data reading copy' : '',
    };
  } finally {
    document.destroy();
  }
}

export async function convertFiles(
  files: Input[],
  options: ConvertOptions,
  progress: Progress,
  emit: Emit,
) {
  if (!files.length) throw Error('Add files before converting.');
  const format = outputFormats.find((format) => format.id === options.target);
  if (!format) throw Error('Choose an available output format.');
  let emitted = 0;
  const combined: Uint8Array[] = [];
  const m = await mu();
  const mergeBuffer =
    options.target === 'pdf' && options.merge !== false && files.length > 1
      ? new m.Buffer()
      : undefined;
  const mergeWriter = mergeBuffer
    ? new m.DocumentWriter(mergeBuffer, 'pdf', 'compress=yes')
    : undefined;
  const send = async (name: string, data: Uint8Array, type = format.mime as string) => {
    await emit({ name, data, type });
    emitted++;
  };
  try {
    for (let source = 0; source < files.length; source++) {
      const input = files[source];
      const name =
        stem(input.name) +
        (files.filter((file) => stem(file.name) === stem(input.name)).length > 1
          ? `-${source + 1}`
          : '');
      if (
        isRaster(input.name) &&
        ['jpg', 'png', 'webp', 'avif', 'heic', 'tiff', 'bmp', 'gif', 'ico', 'svg'].includes(
          options.target,
        )
      ) {
        const frames = await rasterFrames(new Uint8Array(await inputData(input)));
        let indices = selectedPages(options.range ?? '', frames.length);
        if (options.reverse) indices = indices.reverse();
        for (const index of indices) {
          progress(
            `Converting ${input.name} · frame ${index + 1} of ${frames.length}…`,
            (source * 100) / files.length,
          );
          const combinedOutput =
            options.arrangement && options.arrangement !== 'separate' && options.target !== 'svg';
          const png = options.target === 'heic' || combinedOutput;
          const data = await encodeRaster(frames[index], {
            ...options,
            target: png ? 'png' : options.target,
          });
          if (combinedOutput) {
            if (
              combined.reduce((bytes, image) => bytes + image.length, 0) + data.length >
              192 * 1048576
            )
              throw Error(
                'Choose fewer pages or lower resolution for a combined image. Separate files avoid this limit.',
              );
            combined.push(data);
          } else
            await send(
              `${name}${frames.length > 1 ? '-frame-' + (index + 1) : ''}.${png ? 'png' : options.target}`,
              data,
              png ? 'image/png' : format.mime,
            );
        }
        continue;
      }
      const doc = await loadDocument(input, options.currentPassword);
      try {
        let indices = selectedPages(options.range ?? '', doc.countPages());
        if (options.reverse) indices = indices.reverse();
        if (options.target === 'pdf') {
          progress(`Creating PDF ${source + 1} of ${files.length}…`, (source * 100) / files.length);
          if (mergeWriter) {
            for (const index of indices) {
              const page = doc.loadPage(index),
                geometry = pageGeometry(m, page, options);
              const device = mergeWriter.beginPage(geometry.bounds);
              try {
                page.run(device, geometry.matrix);
                device.close();
              } finally {
                device.destroy();
                page.destroy();
              }
              mergeWriter.endPage();
            }
          } else await send(`${name}.pdf`, await writePages(doc, indices, 'pdf', options));
          continue;
        }
        if (['txt', 'md', 'html', 'docx', 'xlsx', 'epub'].includes(options.target)) {
          const pages: string[] = [];
          for (const index of indices) {
            const page = doc.loadPage(index);
            try {
              const text = page.toStructuredText('preserve-whitespace');
              try {
                pages.push(text.asText());
              } finally {
                text.destroy();
              }
            } finally {
              page.destroy();
            }
          }
          if (!pages.join('').trim())
            throw Error(
              'This scan has no text layer. Use Recognize text (OCR), then convert the searchable PDF.',
            );
          if (options.target === 'txt') await send(`${name}.txt`, utf8(pages.join('\n\n')));
          else if (options.target === 'md')
            await send(
              `${name}.md`,
              utf8(pages.map((text, i) => `## Page ${indices[i] + 1}\n\n${text}`).join('\n\n')),
            );
          else if (options.target === 'html')
            await send(
              `${name}.html`,
              utf8(
                `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHTML(name)}</title><body>${pages.map((text, i) => `<section><h2>Page ${indices[i] + 1}</h2><pre style="white-space:pre-wrap">${escapeHTML(text)}</pre></section>`).join('')}</body></html>`,
              ),
            );
          else if (options.target === 'epub') {
            const { zipSync, strToU8 } = await import('fflate');
            const body = pages
              .map((text) => `<p>${escapeHTML(text).replaceAll('\n', '<br/>')}</p>`)
              .join('');
            await send(
              `${name}.epub`,
              zipSync({
                mimetype: [strToU8('application/epub+zip'), { level: 0 }],
                'META-INF/container.xml': strToU8(
                  '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
                ),
                'content.opf': strToU8(
                  `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${escapeHTML(name)}</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="page" href="book.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="page"/></spine></package>`,
                ),
                'book.xhtml': strToU8(
                  `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeHTML(name)}</title></head><body>${body}</body></html>`,
                ),
                'nav.xhtml': strToU8(
                  '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="book.xhtml">Document</a></li></ol></nav></body></html>',
                ),
              }),
            );
          } else {
            const subset = await writePages(doc, indices, 'pdf', options);
            const results = await operate(options.target === 'docx' ? 'word' : 'excel', [
              { name: name + '.pdf', type: 'application/pdf', data: subset.buffer as ArrayBuffer },
            ]);
            for (const result of results) {
              await emit(result);
              emitted++;
            }
          }
          continue;
        }
        if (options.target === 'pptx') {
          const subset = await writePages(doc, indices, 'pdf', options);
          for (const result of await operate(
            'powerpoint',
            [{ name: name + '.pdf', type: 'application/pdf', data: subset.buffer as ArrayBuffer }],
            options,
          )) {
            await emit(result);
            emitted++;
          }
          continue;
        }
        const archive: Record<string, Uint8Array> = {};
        let archiveBytes = 0;
        for (let page = 0; page < indices.length; page++) {
          const index = indices[page];
          progress(
            `Converting ${input.name} · page ${page + 1} of ${indices.length}…`,
            ((source + page / indices.length) / files.length) * 100,
          );
          const outputName = `${name}-page-${String(index + 1).padStart(3, '0')}`;
          if (options.target === 'svg' && !isRaster(input.name)) {
            await send(outputName + '.svg', await writePages(doc, [index], 'svg', options));
            continue;
          }
          if (
            (!options.arrangement || options.arrangement === 'separate') &&
            ['jpg', 'png'].includes(options.target)
          ) {
            await send(
              outputName + '.' + options.target,
              await pagePNG(doc, index, options, options.target === 'jpg'),
            );
            continue;
          }
          const png = await pagePNG(doc, index, options);
          if (options.target === 'cbz') {
            if (options.streamArchive) await send(outputName + '.png', png, 'image/png');
            else {
              archiveBytes += png.length;
              if (archiveBytes > 192 * 1048576)
                throw Error(
                  'Enable direct disk saving for a large comic archive, or select fewer pages.',
                );
              archive[outputName + '.png'] = png;
            }
            continue;
          }
          if (options.arrangement && options.arrangement !== 'separate') {
            if (
              combined.reduce((bytes, image) => bytes + image.length, 0) + png.length >
              192 * 1024 * 1024
            )
              throw Error(
                'Choose fewer pages or lower resolution for a combined image. Separate files avoid this limit.',
              );
            combined.push(png);
            continue;
          }
          // HEIC pixels are encoded in the isolated local encoding window, not on a server.
          if (options.target === 'heic') await send(outputName + '.png', png, 'image/png');
          else
            await send(
              outputName + '.' + options.target,
              await encodeRaster(png, { ...options, crop: 0, rotation: 0 }),
            );
        }
        if (options.target === 'cbz' && !options.streamArchive) {
          const { zipSync } = await import('fflate');
          await send(name + '.cbz', zipSync(archive, { level: 0 }));
        }
      } finally {
        doc.destroy();
      }
    }
    if (mergeWriter && mergeBuffer) {
      mergeWriter.close();
      await send('plivvi-combined.pdf', new Uint8Array(mergeBuffer.asUint8Array()));
    }
    if (combined.length) {
      const png = await joinRaster(
        combined,
        options.arrangement === 'horizontal' ? 'horizontal' : 'vertical',
      );
      if (options.target === 'heic') await send('combined-pages.png', png, 'image/png');
      else
        await send(
          'combined-pages.' + options.target,
          await encodeRaster(png, { ...options, resolution: 0, crop: 0, rotation: 0 }),
        );
    }
    progress('Your converted files are ready.', 100);
    return { count: emitted };
  } finally {
    mergeWriter?.destroy();
    mergeBuffer?.destroy();
  }
}
