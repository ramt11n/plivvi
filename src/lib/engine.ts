import brand from '../brand.json';
import { textDirection } from './unicode';
import { parseRanges, selectedPages } from './catalog';
import type { Input, Output, Preview } from './client';
type Progress = (s: string) => void;
let muPromise: Promise<typeof import('mupdf')>;
export async function mu() {
  return (muPromise ??= import('mupdf'));
}
export async function open(input: Input, password = '') {
  const m = await mu(),
    doc = new m.PDFDocument(input.data);
  if (doc.needsPassword() && !doc.authenticatePassword(password)) {
    doc.destroy();
    throw Error('This PDF needs its current password. Enter it and try again.');
  }
  doc.disableJS();
  if (doc.countPages() > 300) {
    doc.destroy();
    throw Error('Please use a document with 300 pages or fewer in this browser workshop.');
  }
  return doc;
}
function snapshot(doc: import('mupdf').PDFDocument, options = 'garbage=compact,compress=yes') {
  const b = doc.saveToBuffer(options);
  try {
    return new Uint8Array(b.asUint8Array());
  } finally {
    b.destroy();
  }
}
export async function render(
  doc: import('mupdf').PDFDocument,
  index: number,
  width = 1000,
  jpeg = false,
) {
  const m = await mu(),
    page = doc.loadPage(index);
  try {
    const b = page.getBounds(),
      s = Math.min(width / (b[2] - b[0]), 2400 / (b[3] - b[1]));
    const pix = page.toPixmap(m.Matrix.scale(s, s), m.ColorSpace.DeviceRGB, false, true);
    try {
      return {
        data: new Uint8Array(jpeg ? pix.asJPEG(82) : pix.asPNG()),
        width: b[2] - b[0],
        height: b[3] - b[1],
      };
    } finally {
      pix.destroy();
    }
  } finally {
    page.destroy();
  }
}
export async function preview(input: Input, password = '', pageIndex?: number): Promise<Preview> {
  const doc = await open(input, password);
  try {
    const count = doc.countPages(),
      pages = [];
    const indices =
      pageIndex !== undefined
        ? [pageIndex]
        : Array.from({ length: Math.min(count, 60) }, (_, i) => i);
    for (const i of indices) {
      if (i < 0 || i >= count) throw Error('That page does not exist.');
      const r = await render(doc, i, pageIndex === undefined ? 220 : 1100);
      pages.push({ index: i, width: r.width, height: r.height, png: r.data });
    }
    const fields: NonNullable<Preview['fields']> = [],
      seen = new Set<string>();
    for (let i = 0; i < count; i++) {
      const p = doc.loadPage(i);
      const widgets = p.getWidgets();
      try {
        for (const f of widgets) {
          const name = f.getName();
          let options: string[] = [];
          if (f.isChoice()) options = f.getOptions(true);
          else if (f.isCheckbox() || f.isRadioButton())
            f.getObject()
              .get('AP', 'N')
              .forEach((_, k) => {
                if (k !== 'Off') options.push(String(k));
              });
          const existing = fields.find((v) => v.name === name);
          if (existing) existing.options = [...new Set([...(existing.options ?? []), ...options])];
          else {
            fields.push({
              name,
              type: f.getFieldType(),
              value: f.getValue(),
              options,
              readOnly: f.isReadOnly(),
            });
            seen.add(name);
          }
        }
      } finally {
        widgets.forEach((w) => w.destroy());
        p.destroy();
      }
    }
    return { count, pages, fields, title: doc.getMetaData('info:Title') ?? '' };
  } finally {
    doc.destroy();
  }
}
export async function extractText(input: Input, password = '') {
  const doc = await open(input, password);
  try {
    const pages: string[] = [];
    for (let i = 0; i < doc.countPages(); i++) {
      const p = doc.loadPage(i);
      try {
        const t = p.toStructuredText('preserve-whitespace');
        try {
          pages.push(t.asText());
        } finally {
          t.destroy();
        }
      } finally {
        p.destroy();
      }
    }
    return pages;
  } finally {
    doc.destroy();
  }
}
const base = (name: string) => name.replace(/\.[^.]+$/, '');
const output = (name: string, data: Uint8Array, type = 'application/pdf'): Output => ({
  name,
  data,
  type,
});
const enc = (s: string) => new TextEncoder().encode(s);
let fontBytes: Promise<ArrayBuffer>;
async function textPDF(text: string, title = 'Document') {
  const { unicodePDF } = await import('./unicode');
  return unicodePDF(await mu(), text, title);
}
export async function operate(
  id: string,
  files: Input[],
  o: any = {},
  progress: Progress = () => {},
): Promise<Output[]> {
  const { PDFDocument, degrees, rgb, StandardFonts } = await import('pdf-lib');
  if (!files.length) throw Error('Add a file to get started.');
  if (files.reduce((s, f) => s + f.data.byteLength, 0) > 150 * 1048576)
    throw Error('Please work with fewer than 150 MB at a time.');
  const name = base(files[0].name),
    password = o.currentPassword ?? '';
  if (
    ['protect', 'unlock', 'repair', 'flatten', 'redact', 'forms', 'sign', 'annotate'].includes(
      id,
    ) ||
    (id === 'compress' && o.compression !== 'raster')
  ) {
    const m = await mu(),
      doc = await open(files[0], password);
    try {
      let opts = 'garbage=compact,compress=yes';
      if (id === 'protect') {
        if (!o.password || o.password.length < 6)
          throw Error('Choose a password with at least 6 characters.');
        if (/[,=\r\n\0]/.test(o.password))
          throw Error('Use a password without commas, equals signs, or line breaks.');
        opts += `,encrypt=aes-256,user-password=${o.password},owner-password=${crypto.randomUUID()}`;
      }
      if (id === 'unlock') opts += ',encrypt=none';
      if (id === 'flatten') doc.bake(true, true);
      if (id === 'redact') {
        const index = Number(o.page ?? 1) - 1;
        if (index < 0 || index >= doc.countPages()) throw Error('Choose a page that exists.');
        const p = doc.loadPage(index);
        try {
          const b = p.getBounds(),
            w = b[2] - b[0],
            h = b[3] - b[1],
            r = o.rect ?? { x: 0.1, y: 0.1, w: 0.6, h: 0.15 };
          if (r.w < 0.005 || r.h < 0.005)
            throw Error('Draw a rectangle over the content you want to remove.');
          const a = p.createAnnotation('Redact');
          try {
            a.setRect([
              b[0] + w * r.x,
              b[1] + h * r.y,
              b[0] + w * (r.x + r.w),
              b[1] + h * (r.y + r.h),
            ]);
            p.applyRedactions(
              true,
              m.PDFPage.REDACT_IMAGE_PIXELS,
              m.PDFPage.REDACT_LINE_ART_REMOVE_IF_TOUCHED,
              m.PDFPage.REDACT_TEXT_REMOVE,
            );
          } finally {
            a.destroy();
          }
        } finally {
          p.destroy();
        }
      }
      if (id === 'forms') {
        const accepted = new Set<string>();
        for (let i = 0; i < doc.countPages(); i++) {
          const p = doc.loadPage(i),
            widgets = p.getWidgets();
          try {
            for (const field of widgets) {
              const name = field.getName(),
                v = o.fields?.[name];
              if (v === undefined || field.isReadOnly()) continue;
              if (field.isText()) field.setTextValue(v);
              else if (field.isChoice()) {
                if (!field.getOptions(true).includes(v))
                  throw Error(`Choose an available option for ${name}.`);
                field.setChoiceValue(v);
              } else if (field.isCheckbox()) {
                let on = '';
                field
                  .getObject()
                  .get('AP', 'N')
                  .forEach((_, k) => {
                    if (k !== 'Off') on = String(k);
                  });
                if (v !== 'Off' && v !== on)
                  throw Error(`Choose an available checkbox value for ${name}.`);
                if (v !== field.getValue()) field.toggle();
              } else if (field.isRadioButton()) {
                let matches = false;
                field
                  .getObject()
                  .get('AP', 'N')
                  .forEach((_, k) => {
                    if (k !== 'Off' && k === v) matches = true;
                  });
                if (matches) {
                  if (v !== field.getValue()) field.toggle();
                  accepted.add(name);
                }
              }
            }
            p.update();
          } finally {
            widgets.forEach((w) => w.destroy());
            p.destroy();
          }
        }
        for (const [name, value] of Object.entries(o.fields ?? {})) {
          let isRadio = false;
          for (let i = 0; i < doc.countPages(); i++) {
            const p = doc.loadPage(i),
              ws = p.getWidgets();
            try {
              isRadio ||= ws.some((w) => w.getName() === name && w.isRadioButton());
            } finally {
              ws.forEach((w) => w.destroy());
              p.destroy();
            }
          }
          if (isRadio && !accepted.has(name) && value !== 'Off')
            throw Error(`Choose an available option for ${name}.`);
        }
      }
      if (id === 'sign' || id === 'annotate') {
        const index = Number(o.page ?? 1) - 1;
        if (index < 0 || index >= doc.countPages()) throw Error('Choose a valid page.');
        const p = doc.loadPage(index);
        try {
          const b = p.getBounds(),
            w = b[2] - b[0],
            h = b[3] - b[1],
            r = o.rect ?? { x: 0.1, y: 0.15, w: 0.3, h: 0.12 };
          const a = p.createAnnotation(id === 'sign' ? 'Stamp' : 'FreeText');
          try {
            a.setRect([
              b[0] + w * r.x,
              b[1] + h * r.y,
              b[0] + w * (id === 'annotate' ? 0.95 : r.x + r.w),
              b[1] + h * (id === 'annotate' ? Math.min(1, r.y + 0.2) : r.y + r.h),
            ]);
            if (id === 'annotate') {
              a.setBorderWidth(0);
              if (!o.text?.trim()) throw Error('Enter the text you want to add.');
              a.setDefaultAppearance('Helv', Number(o.fontSize ?? 18), [0.13, 0.18, 0.28]);
              a.setContents(o.text);
            } else {
              if (!o.signature) throw Error('Draw your signature first.');
              const binary = atob(o.signature.split(',')[1]),
                data = Uint8Array.from(binary, (c) => c.charCodeAt(0)),
                image = new m.Image(data);
              try {
                a.setStampImage(image);
              } finally {
                image.destroy();
              }
            }
            p.update();
          } finally {
            a.destroy();
          }
        } finally {
          p.destroy();
        }
      }
      let data = snapshot(doc, opts);
      if (id === 'compress' && data.length >= files[0].data.byteLength)
        data = new Uint8Array(files[0].data);
      return [output(`${name}-${id}.pdf`, data)];
    } finally {
      doc.destroy();
    }
  }
  if (['text', 'markdown', 'word', 'excel', 'summary'].includes(id)) {
    const pages = await extractText(files[0], password),
      text = pages.join('\n\n');
    if (!text.trim()) throw Error('This looks like an image-only scan. Use Recognize text first.');
    if (id === 'text') return [output(`${name}.txt`, enc(text), 'text/plain')];
    if (id === 'markdown')
      return [
        output(
          `${name}.md`,
          enc(pages.map((p, i) => `## Page ${i + 1}\n\n${p.trim()}`).join('\n\n')),
          'text/markdown',
        ),
      ];
    if (id === 'summary') {
      const sentences = text.match(/[^.!?\n]+[.!?]?/g) ?? [text],
        freq = new Map<string, number>();
      const stop = new Set(
        'the a an and or is are of in to for on it this that with as by from be was were'.split(
          ' ',
        ),
      );
      const words = (s: string) =>
        s
          .toLowerCase()
          .match(/[\p{L}]{3,}/gu)
          ?.filter((w) => !stop.has(w)) ?? [];
      words(text).forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
      const ranked = sentences
        .map((s, i) => ({
          s: s.trim(),
          i,
          score:
            words(s).reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.max(1, Math.sqrt(s.length)),
        }))
        .filter((s) => s.s.length > 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, Number(o.sentences ?? 6))
        .sort((a, b) => a.i - b.i);
      return [
        output(
          `${name}-summary.txt`,
          enc(
            'EXTRACTIVE SUMMARY\nSelected sentences from the original document.\n\n' +
              (ranked.length ? ranked.map((s) => s.s).join('\n\n') : text.trim()),
          ),
          'text/plain',
        ),
      ];
    }
    if (id === 'word') {
      const { Document, Paragraph, TextRun, Packer } = await import('docx');
      const doc = new Document({
        sections: pages.map((p) => ({
          children: p.split('\n').map(
            (line) =>
              new Paragraph({
                bidirectional: textDirection(line) === 'rtl',
                children: [new TextRun({ text: line, rightToLeft: textDirection(line) === 'rtl' })],
              }),
          ),
        })),
      });
      return [
        output(
          `${name}.docx`,
          new Uint8Array(await Packer.toArrayBuffer(doc)),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ];
    }
    const { default: ExcelJS } = await import('exceljs'),
      wb = new ExcelJS.Workbook();
    pages.forEach((p, i) => {
      const s = wb.addWorksheet(`Page ${i + 1}`, {
        views: [{ rightToLeft: textDirection(p) === 'rtl' }],
      });
      p.split('\n')
        .filter(Boolean)
        .forEach((line) => s.addRow(line.trim().split(/\s{2,}|\t/)));
      s.columns.forEach((c) => (c.width = 28));
    });
    return [
      output(
        `${name}.xlsx`,
        new Uint8Array(await wb.xlsx.writeBuffer()),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ];
  }
  if (
    ['pdf-image', 'powerpoint', 'compare'].includes(id) ||
    (id === 'compress' && o.compression === 'raster')
  ) {
    const docs = [];
    try {
      for (const f of files.slice(0, id === 'compare' ? 2 : 1)) docs.push(await open(f, password));
      if (id === 'compare' && docs.length < 2) throw Error('Add the two PDFs you want to compare.');
      const out: Output[] = [],
        pdf = await PDFDocument.create();
      let ppt: any;
      if (id === 'powerpoint') {
        const { default: PptxGenJS } = await import('pptxgenjs');
        ppt = new PptxGenJS();
        ppt.layout = 'LAYOUT_WIDE';
        ppt.author = brand.name;
      }
      const count =
        id === 'compare'
          ? Math.max(docs[0].countPages(), docs[1].countPages())
          : docs[0].countPages();
      for (let i = 0; i < count; i++) {
        progress(`Processing page ${i + 1} of ${count}…`);
        if (id === 'compare') {
          const p = pdf.addPage([1190.56, 841.89]);
          for (let j = 0; j < 2; j++) {
            p.drawText(j === 0 ? 'ORIGINAL' : 'COMPARISON', {
              x: j * 595.28 + 25,
              y: 810,
              size: 11,
              color: rgb(0.4, 0.43, 0.5),
            });
            if (i < docs[j].countPages()) {
              const r = await render(docs[j], i, 1000, true),
                im = await pdf.embedJpg(r.data),
                s = Math.min(545 / r.width, 740 / r.height);
              p.drawImage(im, {
                x: j * 595.28 + 25 + (545 - r.width * s) / 2,
                y: 45 + (740 - r.height * s) / 2,
                width: r.width * s,
                height: r.height * s,
              });
            }
          }
          continue;
        }
        const r = await render(
          docs[0],
          i,
          id === 'compress'
            ? Math.min(1800, Number(o.resolution ?? 1200))
            : Number(o.resolution ?? 1500),
          id === 'compress' || o.format === 'jpg' || id === 'powerpoint',
        );
        if (id === 'pdf-image') {
          out.push(
            output(
              `${name}-page-${i + 1}.${o.format === 'jpg' ? 'jpg' : 'png'}`,
              r.data,
              o.format === 'jpg' ? 'image/jpeg' : 'image/png',
            ),
          );
          continue;
        }
        if (id === 'powerpoint') {
          let binary = '';
          for (let k = 0; k < r.data.length; k++) binary += String.fromCharCode(r.data[k]);
          const slide = ppt.addSlide();
          const s = Math.min(13.333 / r.width, 7.5 / r.height);
          slide.addImage({
            data: 'image/jpeg;base64,' + btoa(binary),
            x: (13.333 - r.width * s) / 2,
            y: (7.5 - r.height * s) / 2,
            w: r.width * s,
            h: r.height * s,
          });
          continue;
        }
        const image = await pdf.embedJpg(r.data),
          p = pdf.addPage([r.width, r.height]);
        p.drawImage(image, { x: 0, y: 0, width: r.width, height: r.height });
      }
      if (id === 'pdf-image') return out;
      if (id === 'powerpoint')
        return [
          output(
            `${name}.pptx`,
            new Uint8Array(await ppt.write({ outputType: 'arraybuffer' })),
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ),
        ];
      return [output(`${name}-${id}.pdf`, await pdf.save())];
    } finally {
      docs.forEach((d) => d.destroy());
    }
  }
  if (id === 'office-pdf' || id === 'html-pdf') {
    const results: Output[] = [];
    for (const file of files) {
      let text = '';
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'docx') {
        const mammoth = await import('mammoth');
        const r = await mammoth.extractRawText({ arrayBuffer: file.data });
        text = r.value;
      } else if (ext === 'xlsx') {
        const { default: ExcelJS } = await import('exceljs'),
          wb = new ExcelJS.Workbook();
        await wb.xlsx.load(file.data);
        const sheets: string[] = [];
        wb.eachSheet((sheet) => {
          let sheetText = `${sheet.name}\n\n`;
          sheet.eachRow(
            (row) =>
              (sheetText +=
                (row.values as any[])
                  .slice(1)
                  .map((v) =>
                    typeof v === 'object' ? (v?.text ?? v?.result ?? JSON.stringify(v)) : (v ?? ''),
                  )
                  .join('    ') + '\n'),
          );
          sheets.push(sheetText.trimEnd());
        });
        text = sheets.join('\n\f\n');
      } else if (ext === 'pptx') {
        const { unzipSync } = await import('fflate'),
          zip = unzipSync(new Uint8Array(file.data));
        const paths = Object.keys(zip)
          .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
          .sort((a, b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1]));
        text = paths
          .map(
            (p) =>
              new TextDecoder()
                .decode(zip[p])
                .match(/<a:t(?:\s[^>]*)?>[\s\S]*?<\/a:t>/g)
                ?.map((t) => decodeEntities(t.replace(/<[^>]*>/g, '')))
                .join('\n') ?? '',
          )
          .join('\n\f\n');
      } else if (['txt', 'md', 'html', 'htm'].includes(ext ?? '')) {
        text = new TextDecoder().decode(file.data);
        if (ext === 'html' || ext === 'htm')
          text = decodeEntities(
            text
              .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
              .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
              .replace(/<br\s*\/?\s*>/gi, '\n')
              .replace(/<[^>]+>/g, ''),
          );
      } else throw Error('Choose a DOCX, XLSX, PPTX, TXT, Markdown, or HTML file.');
      if (!text.trim()) throw Error('No readable text was found in that file.');
      const filename =
        files.filter((f) => base(f.name) === base(file.name)).length > 1
          ? `${base(file.name)}-${ext}.pdf`
          : `${base(file.name)}.pdf`;
      results.push(output(filename, await textPDF(text, base(file.name))));
    }
    return results;
  }
  if (id === 'ocr-build') {
    const pdf = await PDFDocument.create(),
      fontkit = await import('@pdf-lib/fontkit');
    pdf.registerFontkit(fontkit.default);
    fontBytes ??= fetch('/fonts/DejaVuSans.ttf').then((r) => {
      if (!r.ok) throw Error('The OCR font could not load.');
      return r.arrayBuffer();
    });
    const font = await pdf.embedFont(await fontBytes, { subset: true });
    for (let i = 0; i < files.length; i++) {
      const im = await embedImage(pdf, files[i]),
        scale = Math.min(1, 612 / im.width),
        w = im.width * scale,
        h = im.height * scale,
        p = pdf.addPage([w, h]);
      p.drawImage(im, { x: 0, y: 0, width: w, height: h });
      const data = o.ocrPages[i],
        words = (data.blocks ?? []).flatMap((b: any) =>
          (b.paragraphs ?? []).flatMap((p: any) =>
            (p.lines ?? []).flatMap((l: any) => l.words ?? []),
          ),
        );
      if (words.length)
        for (const word of words) {
          const b = word.bbox,
            text = String(word.text ?? '').trim();
          if (!text) continue;
          const size = Math.max(3, (b.y1 - b.y0) * scale * 0.85);
          p.drawText(text, { x: b.x0 * scale, y: h - b.y1 * scale, size, font, opacity: 0 });
        }
      else {
        let y = h - 20;
        for (const line of String(data.text ?? '').split('\n')) {
          if (y < 10) break;
          p.drawText(line, { x: 12, y, size: 9, font, opacity: 0, maxWidth: w - 24 });
          y -= 12;
        }
      }
    }
    return [output('searchable-document.pdf', await pdf.save())];
  }
  if (id === 'image-pdf' || id === 'scan' || id === 'enhance') {
    const pdf = await PDFDocument.create(),
      layout = o.layout ?? 'a4';
    if (layout === 'id' || layout === 'passport') {
      const p = pdf.addPage([595.28, 841.89]);
      p.drawText(layout === 'id' ? 'IDENTITY DOCUMENT COPY' : 'PASSPORT COPY', {
        x: 55,
        y: 780,
        size: 12,
        color: rgb(0.4, 0.43, 0.5),
      });
      const max = layout === 'id' ? 2 : 1;
      for (let i = 0; i < Math.min(files.length, max); i++) {
        const im = await embedImage(pdf, files[i]),
          maxW = layout === 'id' ? 243 : 440,
          maxH = layout === 'id' ? 154 : 310,
          s = Math.min(maxW / im.width, maxH / im.height);
        p.drawImage(im, {
          x: (595.28 - im.width * s) / 2,
          y: (layout === 'id' ? 600 - i * 225 : 440) + (maxH - im.height * s) / 2,
          width: im.width * s,
          height: im.height * s,
        });
      }
    } else
      for (const f of files) {
        const image = await embedImage(pdf, f),
          size =
            layout === 'original'
              ? [image.width, image.height]
              : layout === 'letter'
                ? [612, 792]
                : [595.28, 841.89],
          p = pdf.addPage(size as [number, number]),
          margin = Number(o.margin ?? 24),
          s = Math.min((size[0] - margin * 2) / image.width, (size[1] - margin * 2) / image.height);
        p.drawImage(image, {
          x: (size[0] - image.width * s) / 2,
          y: (size[1] - image.height * s) / 2,
          width: image.width * s,
          height: image.height * s,
        });
      }
    return [output('pocket-scan.pdf', await pdf.save())];
  }
  if (id === 'merge') {
    const pdf = await PDFDocument.create();
    for (const f of files) {
      const md = await open(f, password);
      let normalized: Uint8Array;
      try {
        normalized = snapshot(md, 'encrypt=none,garbage=compact');
      } finally {
        md.destroy();
      }
      const doc = await PDFDocument.load(normalized);
      for (const p of await pdf.copyPages(doc, doc.getPageIndices())) pdf.addPage(p);
    }
    return [output('merged-document.pdf', await pdf.save())];
  }
  // pdf-lib does not decrypt: normalize a password-protected source with the authenticated engine first.
  let source = files[0].data;
  const mdoc = await open(files[0], password);
  try {
    source = snapshot(mdoc, 'encrypt=none,garbage=compact').buffer as ArrayBuffer;
  } finally {
    mdoc.destroy();
  }
  const doc = await PDFDocument.load(source),
    count = doc.getPageCount(),
    selected = selectedPages(o.range ?? '', count);
  if (id === 'split') {
    const ranges =
        o.splitMode === 'every'
          ? Array.from({ length: count }, (_, i) => [i])
          : parseRanges(o.range ?? '', count),
      out: Output[] = [];
    for (let i = 0; i < ranges.length; i++) {
      const pdf = await PDFDocument.create();
      for (const p of await pdf.copyPages(doc, ranges[i])) pdf.addPage(p);
      out.push(output(`${name}-part-${i + 1}.pdf`, await pdf.save()));
    }
    return out;
  }
  if (['organize', 'extract', 'remove'].includes(id)) {
    const order =
      id === 'organize'
        ? (o.order ?? selected)
        : id === 'remove'
          ? doc.getPageIndices().filter((i) => !selected.includes(i))
          : selected;
    if (!order.length) throw Error('Keep at least one page in the document.');
    const pdf = await PDFDocument.create();
    const copied = await pdf.copyPages(doc, order);
    for (let i = 0; i < copied.length; i++) {
      const p = copied[i];
      if (id === 'organize' && o.rotations?.[i])
        p.setRotation(degrees((p.getRotation().angle + o.rotations[i]) % 360));
      pdf.addPage(p);
    }
    return [output(`${name}-${id}.pdf`, await pdf.save())];
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const index of selected) {
    const page = doc.getPage(index),
      { width: w, height: h } = page.getSize();
    if (id === 'rotate')
      page.setRotation(degrees((page.getRotation().angle + Number(o.rotation ?? 90)) % 360));
    if (id === 'crop') {
      const n = Number(o.margin ?? 24);
      if (n < 0 || n * 2 >= Math.min(w, h)) throw Error('Choose a smaller crop margin.');
      page.setCropBox(n, n, w - 2 * n, h - 2 * n);
    }
    if (id === 'watermark') {
      const text = o.text || 'CONFIDENTIAL',
        size = Math.min(54, w / (text.length * 0.55));
      page.drawText(text, {
        x: w * 0.12,
        y: h * 0.38,
        size,
        font,
        rotate: degrees(35),
        color: rgb(0.25, 0.3, 0.5),
        opacity: Number(o.opacity ?? 0.18),
      });
    }
    if (id === 'numbers') {
      const text = `${Number(o.start ?? 1) + index}`,
        size = 11;
      page.drawText(text, {
        x: (w - font.widthOfTextAtSize(text, size)) / 2,
        y: 22,
        size,
        font,
        color: rgb(0.4, 0.43, 0.5),
      });
    }
    if (id === 'annotate' && index === Number(o.page ?? 1) - 1) {
      const pos = o.rect ?? { x: 0.1, y: 0.15 };
      const text = String(o.text ?? '');
      if (!text.trim()) throw Error('Enter the text you want to add.');
      if (/[^\x20-\x7e\n]/.test(text))
        throw Error(
          'PDF overlay text currently supports basic Latin characters. Use Office to PDF for Unicode document text.',
        );
      page.drawText(text, {
        x: w * pos.x,
        y: h * (1 - pos.y) - Number(o.fontSize ?? 18),
        size: Number(o.fontSize ?? 18),
        font,
        color: rgb(0.13, 0.18, 0.28),
        maxWidth: w * (1 - pos.x) - 15,
      });
    }
    if (id === 'sign' && index === Number(o.page ?? 1) - 1) {
      if (!o.signature) throw Error('Draw your signature first.');
      const im = await doc.embedPng(o.signature),
        pos = o.rect ?? { x: 0.55, y: 0.75, w: 0.3, h: 0.1 };
      page.drawImage(im, {
        x: w * pos.x,
        y: h * (1 - pos.y - pos.h),
        width: w * pos.w,
        height: h * pos.h,
      });
    }
  }
  if (id === 'metadata') {
    doc.setTitle(o.title ?? '');
    doc.setAuthor(o.author ?? '');
    doc.setSubject(o.subject ?? '');
    doc.setKeywords([]);
  }
  return [output(`${name}-${id}.pdf`, await doc.save())];
}
async function embedImage(pdf: import('pdf-lib').PDFDocument, file: Input) {
  const data = new Uint8Array(file.data);
  return data[0] === 137 ? pdf.embedPng(data) : pdf.embedJpg(data);
}
function decodeEntities(s: string) {
  return s
    .replace(
      /&(?:amp|lt|gt|quot|apos|#39|nbsp);/g,
      (t) =>
        ({
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&apos;': "'",
          '&#39;': "'",
          '&nbsp;': ' ',
        })[t] ?? t,
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
export async function template(id: string, o: any = {}): Promise<Output[]> {
  if (id === 'letter')
    return [
      output(
        'formal-letter.pdf',
        await textPDF(
          o.text ||
            'YOUR NAME\nYour address\nEmail / Phone\n\nDate: ____________________\n\nRecipient name\nOrganization\nAddress\n\nSubject: ______________________________\n\nDear ____________________,\n\nWrite your letter here.\n\n\n\nSincerely,\n\n________________________\nYour name',
          'Formal letter',
        ),
      ),
    ];
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib'),
    pdf = await PDFDocument.create(),
    p = pdf.addPage(o.layout === 'letter' ? [612, 792] : [595.28, 841.89]),
    { width: w, height: h } = p.getSize(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.16, 0.19, 0.26),
    light = rgb(0.84, 0.87, 0.91),
    line = (y: number) =>
      p.drawLine({ start: { x: 45, y }, end: { x: w - 45, y }, thickness: 0.6, color: light });
  if (id !== 'blank')
    p.drawText(
      id === 'invoice'
        ? 'INVOICE'
        : id === 'notes'
          ? 'NOTES'
          : id === 'grid'
            ? 'GRAPH PAPER'
            : 'CHECKLIST',
      { x: 45, y: h - 65, size: 20, font, color: ink },
    );
  if (id === 'notes') for (let y = h - 115; y > 45; y -= 25) line(y);
  if (id === 'grid') {
    for (let y = h - 110; y > 45; y -= 15) line(y);
    for (let x = 45; x < w - 44; x += 15)
      p.drawLine({ start: { x, y: 45 }, end: { x, y: h - 110 }, thickness: 0.4, color: light });
  }
  if (id === 'checklist')
    for (let y = h - 125; y > 65; y -= 38) {
      p.drawRectangle({
        x: 45,
        y: y - 3,
        width: 12,
        height: 12,
        borderWidth: 0.8,
        borderColor: light,
      });
      p.drawLine({ start: { x: 72, y }, end: { x: w - 45, y }, thickness: 0.6, color: light });
    }
  if (id === 'invoice') {
    p.drawText('FROM: ___________________________\n\nTO: _____________________________', {
      x: 45,
      y: h - 110,
      size: 11,
      font,
      color: ink,
    });
    p.drawText('NO: ___________\n\nDATE: ___________', {
      x: w - 180,
      y: h - 110,
      size: 11,
      font,
      color: ink,
    });
    p.drawText('DESCRIPTION                             QTY         RATE           AMOUNT', {
      x: 45,
      y: h - 230,
      size: 10,
      font,
      color: ink,
    });
    for (let y = h - 250; y > 230; y -= 40) line(y);
    p.drawText('TOTAL: ____________________', { x: w - 250, y: 170, size: 14, font, color: ink });
    p.drawText('Payment details / Notes: _____________________________________', {
      x: 45,
      y: 105,
      size: 10,
      font,
      color: ink,
    });
  }
  pdf.setTitle(`${brand.name} ${id}`);
  return [output(`${id}-template.pdf`, await pdf.save())];
}
export async function sample(): Promise<Output> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib'),
    pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 3; i++) {
    const p = pdf.addPage([595.28, 841.89]);
    p.drawRectangle({ x: 0, y: 650, width: 595.28, height: 192, color: rgb(0.92, 0.93, 0.99) });
    p.drawText('A LITTLE LESS\nPAPERWORK.', {
      x: 50,
      y: 745,
      size: 30,
      font: bold,
      lineHeight: 38,
      color: rgb(0.18, 0.21, 0.45),
    });
    p.drawText(
      ['Welcome to your workshop', 'Your documents, your device', 'Try something useful'][i],
      { x: 50, y: 590, size: 22, font: bold, color: rgb(0.18, 0.21, 0.3) },
    );
    p.drawText(
      [
        'This is a real, three-page sample PDF.\nTry splitting it, rotating a page, or adding a signature.\n\nUse the page organizer to put things in order.',
        'Files are processed locally in your browser.\nNothing in this sample is a personal document.\n\nSave an output to your workspace or export it through Files.',
        'Merge, split, compress, sign, and convert.\nKeep your original files and export a separate copy.\n\nHere is a test phrase for redaction: POCKET-SECRET-123.',
      ][i],
      { x: 50, y: 540, size: 13, lineHeight: 23, font, color: rgb(0.4, 0.43, 0.5) },
    );
    p.drawText(String(i + 1), { x: 290, y: 35, font, size: 11 });
  }
  return output(`Welcome to ${brand.name}.pdf`, await pdf.save());
}
