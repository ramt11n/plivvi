import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { operate, open, preview, extractText, sample, template, mu } from '../src/lib/engine';
import { parseRanges, selectedPages } from '../src/lib/catalog';
import type { Input, Output } from '../src/lib/client';
const input = (o: Output): Input => ({
  name: o.name,
  type: o.type,
  data: new Uint8Array(o.data).buffer,
});
let fixture: Input;
beforeAll(async () => {
  fixture = input(await sample());
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/fonts/DejaVuSans.ttf') {
      const b = readFileSync('public/fonts/DejaVuSans.ttf');
      return { ok: true, arrayBuffer: async () => new Uint8Array(b).buffer };
    }
    throw Error('Unexpected network request in local processing test: ' + url);
  });
});
describe('page selection', () => {
  it('validates page ranges and preserves requested order', () => {
    expect(parseRanges('3, 1-2', 3)).toEqual([[2], [0, 1]]);
    expect(selectedPages('1-2,2', 3)).toEqual([0, 1]);
    expect(() => parseRanges('0-2', 3)).toThrow();
    expect(() => parseRanges('2-1', 3)).toThrow();
    expect(() => parseRanges('4', 3)).toThrow();
  });
});
describe('PDF operations', () => {
  it('renders real thumbnails and page sizes', async () => {
    const p = await preview(fixture);
    expect(p.count).toBe(3);
    expect(p.pages[0].png[0]).toBe(137);
    expect(p.pages[0].width).toBeCloseTo(595.28);
  });
  it('merges all pages in file order', async () => {
    const [o] = await operate('merge', [fixture, fixture]);
    expect((await PDFDocument.load(o.data)).getPageCount()).toBe(6);
  });
  it('splits every page and custom ranges', async () => {
    expect((await operate('split', [fixture], { splitMode: 'every' })).length).toBe(3);
    const out = await operate('split', [fixture], { splitMode: 'ranges', range: '1-2,3' });
    expect((await PDFDocument.load(out[0].data)).getPageCount()).toBe(2);
    expect(out.length).toBe(2);
  });
  it('extracts, removes and prevents an empty output', async () => {
    const [a] = await operate('extract', [fixture], { range: '2-3' });
    expect((await PDFDocument.load(a.data)).getPageCount()).toBe(2);
    const [b] = await operate('remove', [fixture], { range: '2' });
    expect((await PDFDocument.load(b.data)).getPageCount()).toBe(2);
    await expect(operate('remove', [fixture], { range: '' })).rejects.toThrow('at least one');
  });
  it('reorders, duplicates and rotates chosen pages', async () => {
    const [o] = await operate('organize', [fixture], { order: [2, 0, 0], rotations: [90, 0, 180] });
    const d = await PDFDocument.load(o.data);
    expect(d.getPageCount()).toBe(3);
    expect(d.getPage(0).getRotation().angle).toBe(90);
    expect(d.getPage(2).getRotation().angle).toBe(180);
    const text = await extractText(input(o));
    expect(text[1]).toContain('Welcome to your workshop');
  });
  it('rotates only selected pages', async () => {
    const [o] = await operate('rotate', [fixture], { range: '2', rotation: 90 });
    const d = await PDFDocument.load(o.data);
    expect(d.getPage(0).getRotation().angle).toBe(0);
    expect(d.getPage(1).getRotation().angle).toBe(90);
  });
  it('adds visible watermark and page numbers', async () => {
    const [a] = await operate('watermark', [fixture], { text: 'DRAFT' });
    expect((await extractText(input(a)))[0]).toContain('DRAFT');
    const [b] = await operate('numbers', [fixture], { start: 10 });
    expect((await extractText(input(b)))[0]).toContain('10');
  });
  it('updates metadata and crops visible box', async () => {
    const [a] = await operate('metadata', [fixture], { title: 'My title', author: 'Test' });
    const d = await PDFDocument.load(a.data);
    expect(d.getTitle()).toBe('My title');
    const [b] = await operate('crop', [fixture], { margin: 20 });
    expect((await PDFDocument.load(b.data)).getPage(0).getCropBox().width).toBeCloseTo(555.28);
  });
  it('encrypts with AES-256, rejects wrong passwords, unlocks and merges protected input', async () => {
    const [o] = await operate('protect', [fixture], { password: 'test-pass-42' });
    await expect(open(input(o), 'wrong')).rejects.toThrow('password');
    const d = await open(input(o), 'test-pass-42');
    expect(d.countPages()).toBe(3);
    d.destroy();
    const [unlocked] = await operate('unlock', [input(o)], { currentPassword: 'test-pass-42' });
    expect((await PDFDocument.load(unlocked.data)).getPageCount()).toBe(3);
    const [merged] = await operate('merge', [input(o), fixture], {
      currentPassword: 'test-pass-42',
    });
    expect((await PDFDocument.load(merged.data)).getPageCount()).toBe(6);
  });
  it('handles owner encryption with an empty open password', async () => {
    const m = await mu(),
      d = new m.PDFDocument(fixture.data),
      b = d.saveToBuffer('encrypt=aes-256,user-password=,owner-password=owner-test-42');
    const encrypted: Input = { ...fixture, data: new Uint8Array(b.asUint8Array()).buffer };
    b.destroy();
    d.destroy();
    const [o] = await operate('rotate', [encrypted], { rotation: 90 });
    expect((await PDFDocument.load(o.data)).getPage(0).getRotation().angle).toBe(90);
  });
  it('redacts content from the PDF rather than covering it', async () => {
    const pdf = await PDFDocument.create(),
      p = pdf.addPage([400, 400]);
    p.drawText('SECRET-123', { x: 50, y: 300, size: 20 });
    p.drawText('KEEP THIS', { x: 50, y: 100, size: 20 });
    const f: Input = {
      name: 'secret.pdf',
      type: 'application/pdf',
      data: new Uint8Array(await pdf.save()).buffer,
    };
    const [o] = await operate('redact', [f], {
      page: 1,
      rect: { x: 0.1, y: 0.15, w: 0.7, h: 0.15 },
    });
    const text = (await extractText(input(o))).join('');
    expect(text).not.toContain('SECRET');
    expect(text).toContain('KEEP THIS');
    mkdirSync('test-output', { recursive: true });
    writeFileSync('test-output/redacted.pdf', o.data);
  });
  it('places text consistently on rotated and cropped pages', async () => {
    const pdf = await PDFDocument.create(),
      p = pdf.addPage([400, 500]);
    p.setRotation(degrees(90));
    p.setCropBox(20, 30, 350, 400);
    const f: Input = {
      name: 'rotated.pdf',
      type: 'application/pdf',
      data: new Uint8Array(await pdf.save()).buffer,
    };
    const [o] = await operate('annotate', [f], {
      page: 1,
      text: 'PLACED HERE',
      rect: { x: 0.1, y: 0.15, w: 0.4, h: 0.1 },
      fontSize: 15,
    });
    const m = await open(input(o)),
      page = m.loadPage(0),
      a = page.getAnnotations()[0],
      bounds = page.getBounds(),
      r = a.getRect();
    expect(r[0]).toBeCloseTo(bounds[0] + (bounds[2] - bounds[0]) * 0.1);
    expect(r[1]).toBeCloseTo(bounds[1] + (bounds[3] - bounds[1]) * 0.15);
    a.destroy();
    page.destroy();
    m.destroy();
  });
  it('fills canonical form values including radio options', async () => {
    const pdf = await PDFDocument.create(),
      p = pdf.addPage([400, 400]),
      f = pdf.getForm();
    const text = f.createTextField('Full name');
    text.addToPage(p, { x: 30, y: 300, width: 200, height: 30 });
    const radio = f.createRadioGroup('Choice');
    radio.addOptionToPage('A', p, { x: 30, y: 200, width: 20, height: 20 });
    radio.addOptionToPage('B', p, { x: 70, y: 200, width: 20, height: 20 });
    const chk = f.createCheckBox('Agree');
    chk.addToPage(p, { x: 30, y: 150, width: 20, height: 20 });
    const data: Input = {
      name: 'form.pdf',
      type: 'application/pdf',
      data: new Uint8Array(await pdf.save()).buffer,
    };
    const info = await preview(data);
    const opt = info.fields!.find((v) => v.name === 'Choice')!.options![1];
    const [o] = await operate('forms', [data], {
      fields: { 'Full name': 'Ramtin', Choice: opt, Agree: 'Yes' },
    });
    const out = await PDFDocument.load(o.data);
    expect(out.getForm().getTextField('Full name').getText()).toBe('Ramtin');
    expect(out.getForm().getRadioGroup('Choice').getSelected()).toBe('B');
    expect(out.getForm().getCheckBox('Agree').isChecked()).toBe(true);
    await expect(operate('forms', [data], { fields: { Choice: 'invalid' } })).rejects.toThrow(
      'available option',
    );
  });
  it('lossless compression does not increase file size', async () => {
    const [o] = await operate('compress', [fixture]);
    expect(o.data.length).toBeLessThanOrEqual(fixture.data.byteLength);
  });
  it('exports PNG pages and a side-by-side comparison', async () => {
    const out = await operate('pdf-image', [fixture], { format: 'png', resolution: 500 });
    expect(out.length).toBe(3);
    expect(out[0].data[0]).toBe(137);
    const [c] = await operate('compare', [fixture, fixture]);
    const d = await PDFDocument.load(c.data);
    expect(d.getPageCount()).toBe(3);
    expect(d.getPage(0).getWidth()).toBeCloseTo(1190.56);
  });
  it('exports editable DOCX, inferred XLSX, and page-image PPTX', async () => {
    for (const id of ['word', 'excel', 'powerpoint']) {
      const [o] = await operate(id, [fixture]);
      expect(o.data[0]).toBe(80);
      expect(o.data[1]).toBe(75);
      expect(o.data.length).toBeGreaterThan(1000);
    }
  });
  it('generates all basic templates', async () => {
    for (const id of ['blank', 'letter', 'notes', 'grid', 'invoice', 'checklist']) {
      const [o] = await template(id);
      expect((await PDFDocument.load(o.data)).getPageCount()).toBeGreaterThanOrEqual(1);
    }
  });
  it('creates a searchable PDF containing recognized words', async () => {
    const m = await open(fixture);
    const page = m.loadPage(0),
      pix = page.toPixmap(
        (await mu()).Matrix.scale(0.7, 0.7),
        (await mu()).ColorSpace.DeviceRGB,
        false,
      );
    const jpg = new Uint8Array(pix.asJPEG(80));
    pix.destroy();
    page.destroy();
    m.destroy();
    const [o] = await operate(
      'ocr-build',
      [{ name: 'scan.jpg', type: 'image/jpeg', data: jpg.buffer }],
      { ocrPages: [{ text: 'Recognized words', blocks: [] }] },
    );
    expect((await extractText(input(o)))[0]).toContain('Recognized words');
  });
  it('repairs a damaged cross-reference offset while preserving readable content', async () => {
    const pdf = await PDFDocument.create(),
      p = pdf.addPage([400, 400]);
    p.drawText('RECOVER THIS CONTENT');
    const damaged = Buffer.from(await pdf.save({ useObjectStreams: false }))
      .toString('latin1')
      .replace(/startxref\s+\d+/, 'startxref\n0');
    const [out] = await operate('repair', [
      {
        name: 'damaged.pdf',
        type: 'application/pdf',
        data: new Uint8Array(Buffer.from(damaged, 'latin1')).buffer,
      },
    ]);
    expect((await extractText(input(out)))[0]).toContain('RECOVER THIS CONTENT');
  });
  it('flattens a text annotation into visible page content', async () => {
    const [marked] = await operate('annotate', [fixture], {
      text: 'FLATTENED NOTE',
      page: 1,
      fontSize: 14,
    });
    const [flat] = await operate('flatten', [input(marked)]);
    expect((await extractText(input(flat)))[0]).toContain('FLATTENED NOTE');
    const doc = await open(input(flat)),
      p = doc.loadPage(0);
    expect(p.getAnnotations()).toHaveLength(0);
    p.destroy();
    doc.destroy();
  });
  it('exports text, Markdown, and an extractive summary using the document’s own words', async () => {
    for (const id of ['text', 'markdown', 'summary']) {
      const [out] = await operate(id, [fixture]);
      const text = new TextDecoder().decode(out.data);
      expect(text).toContain('local');
      if (id === 'markdown') expect(text).toContain('## Page 1');
      if (id === 'summary') expect(text).toContain('EXTRACTIVE SUMMARY');
    }
  });
  it('creates a flattened raster compression copy with all pages', async () => {
    const [out] = await operate('compress', [fixture], {
      compression: 'raster',
      resolution: 500,
      quality: 60,
    });
    expect((await PDFDocument.load(out.data)).getPageCount()).toBe(3);
    expect((await extractText(input(out))).join('').trim()).toBe('');
  });
  it('adds a drawn signature as a portable stamp annotation', async () => {
    const [png] = await operate('pdf-image', [fixture], { format: 'png', resolution: 200 });
    const signature = 'data:image/png;base64,' + Buffer.from(png.data).toString('base64');
    const [out] = await operate('sign', [fixture], { signature, page: 1 });
    const doc = await open(input(out)),
      page = doc.loadPage(0),
      annotations = page.getAnnotations();
    expect(annotations.map((a) => a.getType())).toContain('Stamp');
    annotations.forEach((a) => a.destroy());
    page.destroy();
    doc.destroy();
  });
  it('does not add an empty trailing page to an XLSX reading copy and disambiguates batch names', async () => {
    const { default: ExcelJS } = await import('exceljs'),
      wb = new ExcelJS.Workbook();
    wb.addWorksheet('Sheet one').addRow(['AMOUNT', 42]);
    const { default: PptxGenJS } = await import('pptxgenjs'),
      ppt = new PptxGenJS();
    ppt.addSlide().addText('PRESENTATION CHECK', { x: 1, y: 1, w: 6, h: 1 });
    const files: Input[] = [
      {
        name: 'draft.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: new Uint8Array(await wb.xlsx.writeBuffer()).buffer,
      },
      {
        name: 'draft.pptx',
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        data: (await ppt.write({ outputType: 'arraybuffer' })) as ArrayBuffer,
      },
    ];
    const results = await operate('office-pdf', files);
    expect(results.map((o) => o.name)).toEqual(['draft-xlsx.pdf', 'draft-pptx.pdf']);
    expect((await PDFDocument.load(results[0].data)).getPageCount()).toBe(1);
    expect((await extractText(input(results[0])))[0]).toContain('42');
    expect((await extractText(input(results[1])))[0]).toContain('PRESENTATION CHECK');
  });
});
