// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { captureZoomAnchor, restoreZoomAnchor } from '../src/reader/zoomAnchor';
it('keeps the document point beneath the pinch fixed after reflow, including centering and padding changes', () => {
  const surface = document.createElement('div'),
    page = document.createElement('div');
  page.className = 'reader-page';
  surface.append(page);
  document.body.append(surface);
  let rect = new DOMRect(100, -200, 600, 800);
  page.getBoundingClientRect = () => rect;
  surface.scrollLeft = 20;
  surface.scrollTop = 400;
  const anchor = captureZoomAnchor(surface, { x: 250, y: 100 });
  // That point was a quarter across and 3/8 down the page. Zoom with new layout.
  rect = new DOMRect(40, -320, 900, 1200);
  restoreZoomAnchor(surface, anchor);
  expect(surface.scrollLeft).toBe(35); // 40 + 225 - 250 = 15 px correction.
  expect(surface.scrollTop).toBe(430); // -320 + 450 - 100 = 30 px correction.
  surface.remove();
});
it('uses the nearest paper edge in gaps and ignores removed pages', () => {
  const surface = document.createElement('div'),
    page = document.createElement('div');
  page.className = 'reader-page';
  surface.append(page);
  document.body.append(surface);
  page.getBoundingClientRect = () => new DOMRect(0, 0, 600, 800);
  const anchor = captureZoomAnchor(surface, { x: 250, y: 815 })!;
  expect(anchor.y).toBe(1);
  expect(anchor.clientY).toBe(800);
  page.remove();
  restoreZoomAnchor(surface, anchor);
  expect(surface.scrollTop).toBe(0);
  surface.remove();
});

it('restores a scaled point to the moving midpoint in a combined pan and pinch', () => {
  const surface = document.createElement('div'),
    page = document.createElement('div');
  page.className = 'reader-page';
  surface.append(page);
  document.body.append(surface);
  let rect = new DOMRect(100, -200, 600, 800);
  page.getBoundingClientRect = () => rect;
  surface.scrollLeft = 20;
  surface.scrollTop = 400;
  const anchor = captureZoomAnchor(surface, { x: 250, y: 100 })!;
  rect = new DOMRect(40, -320, 900, 1200);
  restoreZoomAnchor(surface, { ...anchor, clientX: 280, clientY: 140 });
  expect(surface.scrollLeft).toBe(5);
  expect(surface.scrollTop).toBe(390);
  surface.remove();
});
