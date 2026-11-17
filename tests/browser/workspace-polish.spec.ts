import { test, expect } from '@playwright/test';
test('one converter banner, Instagram, and refreshed workflow artwork', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.converter-banner')).toHaveCount(1);
  await expect(
    page.locator('footer a[href="https://www.instagram.com/plivvi.app/"]'),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'SVG Studio', exact: true }).click();
  await expect(page.locator('.showcase-product img')).toHaveAttribute(
    'src',
    '/visuals/showcase/vectors-device.svg',
  );
  await expect(page.getByRole('button', { name: 'Open SVG Studio', exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Next feature', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Notebooks', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('.showcase-timeline i').last()).toHaveCSS(
    'transform',
    'matrix(0, 0, 0, 1, 0, 0)',
  );
  await page.screenshot({ path: 'test-output/workbench-3.10.png', fullPage: true });
});
test('SVG workspace layers, saved draft and multilingual source survive reload', async ({
  page,
}) => {
  await page.goto('/svg-studio/');
  await page.locator('.tool-landing-hero button').click();
  const editor = page.getByLabel('SVG code editor');
  await editor.fill(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect x="10" y="10" width="80" height="80" fill="red"/><text x="150" y="150" direction="rtl">سلام دنیا</text></svg>',
  );
  await page.getByRole('button', { name: 'Apply SVG code', exact: true }).click();
  await page.getByRole('button', { name: '1. rect', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate object', exact: true }).click();
  await expect(page.getByRole('button', { name: '3. rect', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete object', exact: true }).click();
  await expect(editor).toContainText('');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('plivvi-svg-draft')))
    .toContain('سلام دنیا');
  await page.reload();
  await page.locator('.tool-landing-hero button').click();
  await expect(page.getByLabel('SVG code editor')).toHaveValue(/سلام دنیا/);
  await page.locator('.modal-shade').evaluate(async (el) => {
    await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished));
  });
  await page.screenshot({ path: 'test-output/studio-3.10.png' });
});
test('reader exposes independent scrolling and motion controls', async ({ page }) => {
  await page.goto('/pdf-reader/');
  await page.locator('input[type=file]').first().setInputFiles('public/samples/pli-free-pages.pdf');
  await page.getByLabel('Page layout', { exact: true }).selectOption('horizontal');
  await expect(page.locator('.reader-scroll')).toHaveClass(/reader-horizontal/);
  await page.getByLabel('Animate page navigation').check();
  await expect(page.locator('.reader-scroll')).toHaveClass(/reader-motion/);
  await page.getByLabel('Reading direction', { exact: true }).selectOption('rtl');
  await expect(page.locator('.reader-page-stack')).toHaveAttribute('dir', 'rtl');
  await page.getByLabel('Page layout', { exact: true }).selectOption('continuous');
  await expect(page.locator('.reader-scroll')).not.toHaveClass(/reader-horizontal/);
});
