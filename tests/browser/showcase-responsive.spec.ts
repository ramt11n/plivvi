import { test, expect } from '@playwright/test';
for (const width of [1900, 900, 390])
  test(`showcase tabs balance at ${width}px and Instagram uses vector icons`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const tabs = page.getByRole('tablist', { name: 'Featured workflows' });
    await page.locator('.feature-showcase').scrollIntoViewIfNeeded();
    await expect(tabs.getByRole('tab')).toHaveCount(6);
    const rows = await tabs.getByRole('tab').evaluateAll((nodes) => {
      const counts = new Map<number, number>();
      for (const node of nodes) {
        const top = Math.round(node.getBoundingClientRect().top);
        counts.set(top, (counts.get(top) || 0) + 1);
      }
      return [...counts.values()];
    });
    expect(rows).toEqual(width === 390 ? [3, 3] : [6]);
    await expect(page.locator('.showcase-tab-timer')).toHaveCount(6);
    expect(
      await page
        .locator('.showcase-tab-timer')
        .first()
        .evaluate((el) => el.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(4);
    await expect(page.locator('.footer-instagram svg rect')).toHaveCount(1);
    await expect(page.locator('.rail-instagram svg')).toHaveCount(1);
    expect(await page.locator('footer').innerText()).not.toContain('\ufffd');
    await page.screenshot({ path: `test-output/showcase-responsive-${width}.png` });
  });
test('visible timer fills over five seconds, pauses and resets from last to first', async ({
  page,
}) => {
  await page.goto('/');
  const tabs = page.getByRole('tablist', { name: 'Featured workflows' });
  await page.locator('.feature-showcase').scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.locator('.showcase-product img').evaluate(async (img: HTMLImageElement) => {
    await img.decode();
  });
  const fill = () => page.locator('[role=tab][aria-selected=true] .showcase-tab-timer i');
  await expect
    .poll(async () =>
      fill().evaluate((el) => Number(getComputedStyle(el).transform.split('(')[1].split(',')[0])),
    )
    .toBeGreaterThan(0.05);
  await page.getByRole('button', { name: 'Pause automatic slides' }).click();
  const paused = await fill().getAttribute('style');
  await page.mouse.move(0, 0);
  await expect(fill()).toHaveAttribute('style', paused!);
  await page.getByRole('tab', { name: 'SVG Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Next feature', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Notebooks', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  for (const timer of await page.locator('.showcase-tab-timer i').all())
    await expect(timer).toHaveCSS('transform', 'matrix(0, 0, 0, 1, 0, 0)');
});
