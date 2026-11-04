export type ZoomAnchor = {
  element: Element;
  x: number;
  y: number;
  clientX: number;
  clientY: number;
};
export function captureZoomAnchor(
  surface: HTMLElement,
  point: { x: number; y: number },
): ZoomAnchor | null {
  let nearest: { element: Element; rect: DOMRect; gap: number } | undefined;
  for (const element of surface.querySelectorAll('.reader-page')) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const gap = Math.max(rect.top - point.y, point.y - rect.bottom, 0);
    if (!nearest || gap < nearest.gap) nearest = { element, rect, gap };
  }
  if (!nearest) return null;
  const { element, rect } = nearest;
  // In a page gap, hold the nearest paper edge rather than extrapolating a scaled gap.
  const clientY = Math.max(rect.top, Math.min(rect.bottom, point.y));
  return {
    element,
    x: (point.x - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
    clientX: point.x,
    clientY,
  };
}
export function restoreZoomAnchor(surface: HTMLElement, anchor: ZoomAnchor | null) {
  if (!anchor?.element.isConnected) return;
  const rect = anchor.element.getBoundingClientRect();
  surface.scrollLeft += rect.left + anchor.x * rect.width - anchor.clientX;
  surface.scrollTop += rect.top + anchor.y * rect.height - anchor.clientY;
}
