import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strToU8, zipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { sampleComic } from '../fixtures/sampleComic';
import * as mupdf from 'mupdf';

test('image encoders write real files, preserve PNG transparency and round-trip each supported codec', async ({
  page,
}) => {
  await page.goto('/file-converter/');
  await page.locator('.tool-landing-hero button').click();
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 120;
    c.height = 80;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(10, 10, 80, 50);
    return c.toDataURL().split(',')[1];
  });
  const input = page.locator('.converter-panel input[type=file]');
  await input.setInputFiles({
    name: 'source.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  for (const target of ['jpg', 'png', 'webp', 'avif', 'tiff', 'bmp', 'gif', 'ico', 'svg']) {
    await test.step(target, async () => {
      await page.getByLabel('Convert to', { exact: true }).selectOption(target);
      await page.getByRole('button', { name: 'Convert files' }).click();
      await expect(page.locator('.converter-result')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Convert files' })).toBeVisible();
      const download = page.waitForEvent('download');
      await page
        .locator('.converter-result')
        .getByRole('button', { name: /^Download/ })
        .click();
      const file = await download,
        data = await readFile((await file.path())!);
      expect(file.suggestedFilename()).toBe('source.' + target);
      if (target === 'png') {
        const pixel = await page.evaluate(async (base64) => {
          const binary = atob(base64),
            bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
          const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(image, 0, 0);
          return Array.from(ctx.getImageData(0, 0, 1, 1).data);
        }, data.toString('base64'));
        expect(pixel[3]).toBe(0);
      }
      if (target === 'svg') {
        const svg = data.toString();
        expect(svg).toMatch(/<path/);
        expect(svg).not.toContain('<image');
      } else {
        // Re-import the actual encoded file in the browser and decode it into a PDF.
        await page.getByRole('button', { name: 'Remove source.png' }).click();
        await input.setInputFiles({
          name: 'roundtrip.' + target,
          mimeType: 'application/octet-stream',
          buffer: data,
        });
        await page.getByLabel('Convert to', { exact: true }).selectOption('pdf');
        await page.getByRole('button', { name: 'Convert files' }).click();
        await expect(page.locator('.converter-result')).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'Convert files' })).toBeVisible();
        const pdf = page.waitForEvent('download');
        await page
          .locator('.converter-result')
          .getByRole('button', { name: /^Download/ })
          .click();
        expect(
          (await PDFDocument.load(await readFile((await (await pdf).path())!))).getPageCount(),
        ).toBe(1);
        await page.getByRole('button', { name: 'Remove roundtrip.' + target, exact: true }).click();
        await input.setInputFiles({
          name: 'source.png',
          mimeType: 'image/png',
          buffer: Buffer.from(png, 'base64'),
        });
      }
    });
  }
});
test('document, comic and text outputs have usable reverse conversions', async ({ page }) => {
  const source = await PDFDocument.create();
  const first = source.addPage([400, 500]);
  first.drawText('PLIVVI REVERSE CONVERSION', { x: 25, y: 440, size: 16 });
  first.drawText('Local files can become useful reading copies.', { x: 25, y: 390, size: 12 });
  const bytes = Buffer.from(await source.save());
  await page.goto('/file-converter/');
  await page.locator('.tool-landing-hero button').click();
  const input = page.locator('.converter-panel input[type=file]');
  await input.setInputFiles({ name: 'source.pdf', mimeType: 'application/pdf', buffer: bytes });
  for (const target of ['pdf', 'txt', 'md', 'html', 'docx', 'xlsx', 'pptx', 'cbz', 'epub']) {
    await test.step(target, async () => {
      await page.getByLabel('Convert to', { exact: true }).selectOption(target);
      await page.getByRole('button', { name: 'Convert files' }).click();
      await expect(page.locator('.converter-result')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Convert files' })).toBeVisible();
      const download = page.waitForEvent('download');
      await page
        .locator('.converter-result')
        .getByRole('button', { name: /^Download/ })
        .click();
      const file = await download,
        data = await readFile((await file.path())!);
      if (['cbz', 'epub', 'docx', 'xlsx', 'pptx'].includes(target))
        expect(Object.keys(unzipSync(data)).length).toBeGreaterThan(0);
      if (target === 'epub') {
        const zip = unzipSync(data);
        expect(new TextDecoder().decode(zip.mimetype)).toBe('application/epub+zip');
        expect(new TextDecoder().decode(zip['book.xhtml'])).toContain('PLIVVI REVERSE');
      }
      if (['txt', 'md', 'html'].includes(target))
        expect(data.toString()).toContain('PLIVVI REVERSE');
      await page.getByRole('button', { name: 'Remove source.pdf' }).click();
      await input.setInputFiles({
        name: 'reverse.' + target,
        mimeType: file.suggestedFilename().endsWith('.pdf')
          ? 'application/pdf'
          : 'application/octet-stream',
        buffer: data,
      });
      await page.getByLabel('Convert to', { exact: true }).selectOption('pdf');
      await page.getByRole('button', { name: 'Convert files' }).click();
      await expect(page.locator('.converter-result')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Convert files' })).toBeVisible();
      const reverse = page.waitForEvent('download');
      await page
        .locator('.converter-result')
        .getByRole('button', { name: /^Download/ })
        .click();
      const doc = new mupdf.PDFDocument(
        new Uint8Array(await readFile((await (await reverse).path())!)),
      );
      expect(doc.countPages()).toBeGreaterThan(0);
      doc.destroy();
      await page.getByRole('button', { name: 'Remove reverse.' + target, exact: true }).click();
      await input.setInputFiles({ name: 'source.pdf', mimeType: 'application/pdf', buffer: bytes });
    });
  }
});
test('CBR archive imports and exports all comic pages', async ({ page }) => {
  await page.goto('/file-converter/');
  await page.locator('.tool-landing-hero button').click();
  await page.locator('.converter-panel input[type=file]').setInputFiles({
    name: 'comic.cbr',
    mimeType: 'application/vnd.comicbook-rar',
    buffer: sampleComic(),
  });
  await expect(page.locator('.converter-source')).toContainText('3 pages');
  await page.getByLabel('Convert to', { exact: true }).selectOption('png');
  await page.getByRole('button', { name: 'Convert files' }).click();
  await expect(page.locator('.converter-result')).toHaveCount(3);
});
test('disk ZIP output is streamed through browser storage when no native picker is present', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }),
  );
  await page.goto('/pdf-to-jpg/');
  await page.locator('.tool-landing-hero button').click();
  await page
    .locator('.converter-panel input[type=file]')
    .setInputFiles('public/samples/pli-free-pages.pdf');
  await page.getByLabel('Save directly to a ZIP on disk').check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Convert files' }).click();
  const zip = unzipSync(new Uint8Array(await readFile((await (await download).path())!)));
  expect(Object.keys(zip)).toHaveLength(2);
  for (const jpg of Object.values(zip))
    expect(Array.from(jpg.slice(0, 3))).toEqual([255, 216, 255]);
  await expect(page.locator('.converter-footer')).toContainText('Saved 2 files');
});
test('reader opens a file-backed PDF through its actual UI', async ({ page }) => {
  await page.goto('/pdf-reader/');
  await page.locator('.tool-landing-hero button').click();
  await page
    .locator('.reader-shell input[type=file]')
    .first()
    .setInputFiles('public/samples/pli-free-pages.pdf');
  await expect(page.locator('.reader-shell canvas').first()).toBeVisible();
  await expect(page.locator('.reader-shell')).not.toContainText('Choose a PDF or a CBR comic');
});
