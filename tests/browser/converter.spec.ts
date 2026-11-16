import { test, expect, type Page } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { largePDF } from './fixtures';

const sample = path.resolve('public/samples/pli-free-pages.pdf');
async function openConverter(page: Page, route = '/pdf-to-jpg/') {
  await page.goto(route);
  await page.locator('.tool-landing-hero button').click();
  await expect(page.locator('.converter-panel')).toBeVisible();
  await page.locator('.converter-panel input[type=file]').setInputFiles(sample);
  await expect(page.locator('.converter-source')).toContainText('2 pages');
}
async function convert(page: Page, count: number) {
  await page.getByRole('button', { name: 'Convert files', exact: false }).click();
  await expect(page.locator('.converter-result')).toHaveCount(count);
  await expect(page.getByRole('button', { name: 'Convert files', exact: false })).toBeVisible();
  expect(await page.locator('.converter-error').allTextContents()).toEqual([]);
}
test('two-page PDF: separate JPEGs, selected PNG and joined image have real pixels', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openConverter(page);
  await convert(page, 2);
  const download = page.waitForEvent('download');
  await page
    .locator('.converter-result')
    .getByRole('button', { name: /^Download / })
    .first()
    .click();
  const file = await download,
    data = await readFile((await file.path())!);
  expect(file.suggestedFilename()).toMatch(/page-001.jpg$/);
  expect([...data.subarray(0, 3)]).toEqual([255, 216, 255]);
  await page.getByLabel('Convert to', { exact: true }).selectOption('png');
  await page.getByLabel('Pages', { exact: true }).fill('2');
  await convert(page, 1);
  expect(await page.locator('.converter-result strong').textContent()).toMatch(/002.png$/);
  await page.getByLabel('Pages', { exact: true }).fill('');
  await page.getByLabel('Page arrangement').selectOption('vertical');
  await convert(page, 1);
  const joined = page.waitForEvent('download');
  await page
    .locator('.converter-result')
    .getByRole('button', { name: /^Download / })
    .click();
  const image = await readFile((await (await joined).path())!);
  expect(image.toString('ascii', 1, 4)).toBe('PNG');
  const pdf = await PDFDocument.load(await readFile(sample));
  const expectedHeight = pdf
    .getPages()
    .reduce((h, page) => h + Math.ceil((1500 * page.getHeight()) / page.getWidth()), 0);
  expect(image.readUInt32BE(16)).toBe(1500);
  expect(image.readUInt32BE(20)).toBe(expectedHeight);
  await page.screenshot({ path: 'test-output/converter-desktop.png' });
  expect(errors).toEqual([]);
});
test('PDF to SVG exports real vector paths and SVG studio creates editable vectors', async ({
  page,
}) => {
  await openConverter(page);
  await page.getByLabel('Convert to', { exact: true }).selectOption('svg');
  await page.getByLabel('Pages', { exact: true }).fill('1');
  await convert(page, 1);
  await page.getByRole('button', { name: 'SVG code', exact: true }).click();
  const code = await page.getByLabel('Exported SVG code').inputValue();
  expect(code).toContain('<svg');
  expect(code).toMatch(/<(path|use)/);
  await page.getByRole('button', { name: 'Close converter' }).click();
  await page.goto('/svg-studio/');
  await page.locator('.tool-landing-hero button').click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  const box = (await page.getByLabel('Vector drawing canvas').boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 140);
  await page.mouse.up();
  expect(await page.getByLabel('SVG code editor').inputValue()).toContain('<rect');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await page.getByLabel('SVG code editor').inputValue()).not.toContain('<rect');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG', exact: true }).click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).toContain('<rect');
  await page.getByRole('button', { name: 'New blank drawing' }).click();
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.up();
  expect(await page.getByLabel('SVG code editor').inputValue()).toContain('<rect');
});
test('HEIC encoder window is isolated and produces a decodable HEIC file', async ({ page }) => {
  await page.goto('/file-converter/');
  await page.locator('.tool-landing-hero button').click();
  const png = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ed304a';
    ctx.fillRect(0, 0, 64, 48);
    return canvas.toDataURL().split(',')[1];
  });
  await page.locator('.converter-panel input[type=file]').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await page.getByLabel('Convert to', { exact: true }).selectOption('heic');
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Convert files', exact: false }).click();
  const window = await popup;
  await window.waitForLoadState('domcontentloaded');
  expect(await window.evaluate(() => crossOriginIsolated)).toBe(true);
  await expect(page.locator('.converter-result')).toHaveCount(1, { timeout: 100000 });
  const download = page.waitForEvent('download');
  await page
    .locator('.converter-result')
    .getByRole('button', { name: /^Download / })
    .click();
  const heic = await readFile((await (await download).path())!);
  expect(heic.toString('ascii', 4, 8)).toBe('ftyp');
  expect(heic.toString('ascii', 8, 40)).toMatch(/(heic|heix|mif1)/);
  // Feed the output back through the actual browser decoder, then export PNG.
  await page.getByLabel('Convert to', { exact: true }).selectOption('png');
  await page.getByRole('button', { name: 'Remove photo.png' }).click();
  await page
    .locator('.converter-panel input[type=file]')
    .setInputFiles({ name: 'roundtrip.heic', mimeType: 'image/heic', buffer: heic });
  await convert(page, 1);
  const roundtrip = page.waitForEvent('download');
  await page
    .locator('.converter-result')
    .getByRole('button', { name: /^Download / })
    .click();
  const output = await readFile((await (await roundtrip).path())!);
  expect(output.readUInt32BE(16)).toBe(64);
  expect(output.readUInt32BE(20)).toBe(48);
});
test('converter works at phone width without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openConverter(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-output/converter-mobile.png', fullPage: true });
});
test('a PDF larger than 1 GiB is inspected and rendered without reading the entire File', async ({
  page,
}) => {
  const file = await largePDF();
  await page.addInitScript(() => {
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      if (this.size > 1024 * 1024 * 1024) throw Error('Whole large File read attempted');
      return read.call(this);
    };
  });
  await page.goto('/pdf-to-jpg/');
  await page.locator('.tool-landing-hero button').click();
  await page.locator('.converter-panel input[type=file]').setInputFiles(file);
  await expect(page.locator('.converter-source')).toContainText('2 pages');
  await page.getByLabel('Pages', { exact: true }).fill('2');
  await convert(page, 1);
  const download = page.waitForEvent('download');
  await page
    .locator('.converter-result')
    .getByRole('button', { name: /^Download / })
    .click();
  const jpg = await readFile((await (await download).path())!);
  expect([...jpg.subarray(0, 3)]).toEqual([255, 216, 255]);
});

test('converted pages can be combined back into a PDF, saved and opened in the reader', async ({
  page,
}) => {
  await openConverter(page);
  await convert(page, 2);
  await page.getByRole('button', { name: 'Convert these files again' }).click();
  await expect(page.locator('.converter-source')).toHaveCount(2);
  await expect(page.getByLabel('Convert to', { exact: true })).toHaveValue('pdf');
  await convert(page, 1);
  await page
    .locator('.converter-result')
    .getByRole('button', { name: 'Save to workspace' })
    .click();
  await expect(page.locator('.converter-footer')).toContainText('Saved to your workspace');
  await page.getByRole('button', { name: 'Read PDF', exact: true }).click();
  await expect(page.locator('.reader-shell canvas').first()).toBeVisible();
});

test('an exported image opens the crop editor and produces an editable JPG source', async ({
  page,
}) => {
  await openConverter(page);
  await page.getByLabel('Pages', { exact: true }).fill('1');
  await convert(page, 1);
  await page.getByRole('button', { name: 'Edit image', exact: true }).click();
  await page.getByRole('button', { name: 'Save enhanced page', exact: true }).click();
  await expect(page.locator('.converter-source')).toContainText('enhanced.jpg');
  await expect(page.getByRole('button', { name: 'Close scan editor' })).toHaveCount(0);
  await convert(page, 1);
});
