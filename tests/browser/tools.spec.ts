import { test, expect, type Page } from '@playwright/test';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import * as mupdf from 'mupdf';
import { sampleComic } from '../fixtures/sampleComic';

let pdfBytes: number[], formBytes: number[];
test.beforeAll(async () => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 3; i++) {
    const page = pdf.addPage([400, 500]);
    page.drawText(`PLIVVI PAGE ${i + 1}`, { x: 30, y: 450, size: 20 });
    page.drawText('Private local documents. Useful tools work on this device.', {
      x: 30,
      y: 400,
      size: 10,
    });
    page.drawText('ITEM       AMOUNT\nPaper          42', { x: 30, y: 350, size: 12 });
  }
  pdfBytes = Array.from(await pdf.save());
  const form = await PDFDocument.create(),
    page = form.addPage([400, 500]);
  const field = form.getForm().createTextField('Full name');
  field.addToPage(page, { x: 30, y: 350, width: 200, height: 30 });
  formBytes = Array.from(await form.save());
});
async function worker(page: Page) {
  const url =
    '/assets/' + (await readdir('dist/assets')).find((file) => /^pdf.worker-.*\.js$/.test(file));
  await page.goto('/');
  await page.evaluate(
    ({ url, bytes, form }) => {
      const w = new Worker(url, { type: 'module' });
      let seq = 0;
      const pending = new Map<
        number,
        { resolve: (value: any) => void; reject: (error: Error) => void; outputs: any[] }
      >();
      (window as any).auditInput = {
        name: 'audit.pdf',
        type: 'application/pdf',
        data: new ArrayBuffer(0),
        file: new File([new Uint8Array(bytes)], 'audit.pdf', { type: 'application/pdf' }),
      };
      (window as any).auditForm = {
        name: 'form.pdf',
        type: 'application/pdf',
        data: new Uint8Array(form).buffer,
      };
      w.onmessage = ({ data }) => {
        const task = pending.get(data.id);
        if (!task) return;
        if (data.progress) return;
        if (data.output) {
          task.outputs.push(data.output);
          w.postMessage({ id: data.id, op: 'convert-ack' });
          return;
        }
        pending.delete(data.id);
        data.error
          ? task.reject(Error(data.error))
          : task.resolve(task.outputs.length ? task.outputs : data.result);
      };
      w.onerror = (event) => {
        for (const task of pending.values()) task.reject(Error(event.message));
        pending.clear();
      };
      (window as any).auditRPC = (op: string, payload: any) =>
        new Promise((resolve, reject) => {
          const id = ++seq;
          pending.set(id, { resolve, reject, outputs: [] });
          w.postMessage({ id, op, payload });
        });
    },
    { url, bytes: pdfBytes, form: formBytes },
  );
}
async function operation(page: Page, tool: string, options = {}, source = 'pdf') {
  return page.evaluate(
    async ({ tool, options, source }) => {
      const rpc = (window as any).auditRPC,
        input = (window as any)[source === 'form' ? 'auditForm' : 'auditInput'];
      let files = ['merge', 'compare'].includes(tool) ? [input, input] : [input];
      if (source === 'image' || tool === 'sign') {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 90;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#3457da';
        ctx.fillRect(0, 0, 120, 90);
        ctx.fillStyle = '#fff';
        ctx.fillRect(20, 20, 50, 30);
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((blob) => resolve(blob!), 'image/png'),
        );
        if (tool === 'sign') (options as any).signature = canvas.toDataURL();
        else files = [{ name: 'photo.png', type: 'image/png', data: await blob.arrayBuffer() }];
      }
      if (source === 'text')
        files = [
          {
            name: 'notes.html',
            type: 'text/html',
            data: new TextEncoder().encode('<h1>PLIVVI IMPORT</h1><p>Useful local conversion.</p>')
              .buffer,
          },
        ];
      const results = await rpc('operate', { tool, files, options });
      return results.map((result: any) => ({
        name: result.name,
        type: result.type,
        data: Array.from(result.data) as number[],
      }));
    },
    { tool, options, source },
  );
}
const matrix: { id: string; options?: Record<string, unknown>; source?: string; pages?: number }[] =
  [
    { id: 'scan', source: 'image', pages: 1 },
    { id: 'enhance', source: 'image', pages: 1 },
    { id: 'merge', pages: 6 },
    { id: 'split', options: { splitMode: 'every' }, pages: 1 },
    { id: 'organize', options: { order: [2, 0, 0], rotations: [90, 0, 180] }, pages: 3 },
    { id: 'extract', options: { range: '2-3' }, pages: 2 },
    { id: 'remove', options: { range: '2' }, pages: 2 },
    { id: 'rotate', options: { range: '2', rotation: 90 }, pages: 3 },
    { id: 'compress', pages: 3 },
    { id: 'repair', pages: 3 },
    { id: 'image-pdf', source: 'image', pages: 1 },
    { id: 'pdf-image', options: { format: 'jpg', resolution: 400 } },
    { id: 'text' },
    { id: 'markdown' },
    { id: 'word' },
    { id: 'excel' },
    { id: 'powerpoint', options: { resolution: 400 } },
    { id: 'html-pdf', source: 'text', pages: 1 },
    { id: 'sign', pages: 3 },
    { id: 'annotate', options: { text: 'AUDIT NOTE', page: 1 }, pages: 3 },
    { id: 'watermark', options: { text: 'AUDIT WATERMARK' }, pages: 3 },
    { id: 'numbers', options: { start: 10 }, pages: 3 },
    { id: 'crop', options: { margin: 20 }, pages: 3 },
    { id: 'forms', source: 'form', options: { fields: { 'Full name': 'Ramtin Audit' } }, pages: 1 },
    { id: 'protect', options: { password: 'audit-pass-42' }, pages: 3 },
    { id: 'redact', options: { page: 1, rect: { x: 0, y: 0, w: 1, h: 0.2 } }, pages: 3 },
    { id: 'compare', pages: 3 },
    { id: 'flatten', pages: 3 },
    { id: 'metadata', options: { title: 'AUDIT TITLE', author: 'Plivvi' }, pages: 3 },
    { id: 'summary' },
  ];
for (const row of matrix)
  test(`existing tool ${row.id} exports a usable file in Brave`, async ({ page }) => {
    await worker(page);
    const outputs = await operation(page, row.id, row.options, row.source);
    expect(outputs.length).toBeGreaterThan(0);
    for (const output of outputs) {
      const data = new Uint8Array(output.data);
      expect(data.length).toBeGreaterThan(20);
      if (output.type === 'application/pdf') {
        const doc = new mupdf.PDFDocument(data);
        try {
          if (row.id === 'protect') expect(doc.authenticatePassword('audit-pass-42')).toBeTruthy();
          expect(doc.countPages()).toBe(row.pages);
          const p = doc.loadPage(0),
            pix = p.toPixmap(mupdf.Matrix.scale(0.2, 0.2), mupdf.ColorSpace.DeviceRGB, false);
          expect(pix.getWidth()).toBeGreaterThan(20);
          pix.destroy();
          p.destroy();
        } finally {
          doc.destroy();
        }
        if (row.id === 'forms')
          expect((await PDFDocument.load(data)).getForm().getTextField('Full name').getText()).toBe(
            'Ramtin Audit',
          );
        if (row.id === 'metadata')
          expect((await PDFDocument.load(data)).getTitle()).toBe('AUDIT TITLE');
        if (row.id === 'crop')
          expect((await PDFDocument.load(data)).getPage(0).getCropBox().width).toBe(360);
        if (row.id === 'rotate')
          expect((await PDFDocument.load(data)).getPage(1).getRotation().angle).toBe(90);
      } else if (output.type.startsWith('text/'))
        expect(new TextDecoder().decode(data)).toMatch(/PLIVVI|Private|local|Useful tools/);
      else if (row.id === 'pdf-image')
        expect(Array.from(data.slice(0, 3))).toEqual([255, 216, 255]);
      else {
        const entries = unzipSync(data);
        expect(Object.keys(entries)).toContain('[Content_Types].xml');
        if (row.id === 'word')
          expect(new TextDecoder().decode(entries['word/document.xml'])).toContain('PLIVVI PAGE');
        if (row.id === 'excel')
          expect(Object.keys(entries).some((key) => /xl\/worksheets\/sheet/.test(key))).toBe(true);
        if (row.id === 'powerpoint')
          expect(
            Object.keys(entries).filter((key) => /^ppt\/slides\/slide\d+\.xml$/.test(key)),
          ).toHaveLength(3);
      }
    }
  });
test('unlock, reader, Office import and image conversion reverse paths work in the built worker', async ({
  page,
}) => {
  await worker(page);
  const results = await page.evaluate(async () => {
    const rpc = (window as any).auditRPC,
      input = (window as any).auditInput;
    const [protectedPDF] = await rpc('operate', {
      tool: 'protect',
      files: [input],
      options: { password: 'audit-pass-42' },
    });
    const [unlocked] = await rpc('operate', {
      tool: 'unlock',
      files: [{ ...protectedPDF, data: protectedPDF.data.buffer }],
      options: { currentPassword: 'audit-pass-42' },
    });
    const info = await rpc('reader-open', { input });
    const text = await rpc('reader-text', { session: info.session, index: 0 });
    const hits = await rpc('reader-search', { session: info.session, query: 'PLIVVI' });
    const rendered = await rpc('reader-render', { session: info.session, index: 1, width: 300 });
    await rpc('reader-close', { session: info.session });
    const imports = [];
    for (const id of ['word', 'excel', 'powerpoint']) {
      const [output] = await rpc('operate', {
        tool: id,
        files: [input],
        options: { resolution: 300 },
      });
      const [copy] = await rpc('operate', {
        tool: 'office-pdf',
        files: [{ ...output, data: output.data.buffer }],
        options: {},
      });
      imports.push({ id, length: copy.data.length });
    }
    return {
      unlocked: Array.from(unlocked.data) as number[],
      count: info.count,
      text: text.text,
      hits: hits.length,
      rendered: rendered.data[0],
      imports,
    };
  });
  expect((await PDFDocument.load(new Uint8Array(results.unlocked))).getPageCount()).toBe(3);
  expect(results.count).toBe(3);
  expect(results.text).toContain('PLIVVI PAGE');
  expect(results.hits).toBe(3);
  expect(results.rendered).toBe(137);
});
test('corrupt input reports a job error and the same worker can process a valid PDF afterwards', async ({
  page,
}) => {
  await worker(page);
  const result = await page.evaluate(async () => {
    const rpc = (window as any).auditRPC;
    let error = '';
    try {
      await rpc('preview', {
        input: { name: 'corrupt.pdf', data: new TextEncoder().encode('not a PDF').buffer },
      });
    } catch (e) {
      error = (e as Error).message;
    }
    const valid = await rpc('preview', {
      input: (window as any).auditInput,
      options: { limit: 2, fields: false },
    });
    return { error, count: valid.count, previews: valid.pages.length };
  });
  expect(result.error).not.toBe('');
  expect(result.count).toBe(3);
  expect(result.previews).toBe(2);
});
test('OCR reads actual pixels through the local Tesseract worker', async ({ page }) => {
  await page.goto('/ocr-pdf/');
  // Use the canonical route from the actual link so this remains valid if the slug changes.
  if (!(await page.locator('.tool-landing-hero button').count())) {
    await page.goto('/tools/');
    await page.locator('a.tool-card').filter({ hasText: 'Recognize text' }).click();
  } else await page.locator('.tool-landing-hero button').click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 250;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1000, 250);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 72px Arial';
    ctx.fillText('PLIVVI TEST 1234', 40, 130);
    return canvas.toDataURL().split(',')[1];
  });
  await page
    .locator('.tool-panel input[type=file]')
    .setInputFiles({ name: 'ocr.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page
    .locator('.tool-panel')
    .getByRole('button', { name: 'Recognize text', exact: true })
    .click();
  await expect(page.locator('.result-file')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page
    .locator('.result-file')
    .getByRole('button', { name: /^Download/ })
    .first()
    .click();
  expect(await readFile((await (await download).path())!, 'utf8')).toMatch(/PLIVVI TEST 1234/i);
});
