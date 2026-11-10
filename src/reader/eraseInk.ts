import { isStroke, pressureWidth, strokePressure, type InkPoint, type Mark } from './types';

type Point = Pick<InkPoint, 'x' | 'y'>;
const strokeBounds = new WeakMap<
  Mark,
  { left: number; top: number; right: number; bottom: number }
>();
function boundsFor(mark: Mark) {
  let bounds = strokeBounds.get(mark);
  if (!bounds) {
    bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const p of mark.points) {
      bounds.left = Math.min(bounds.left, p.x);
      bounds.top = Math.min(bounds.top, p.y);
      bounds.right = Math.max(bounds.right, p.x);
      bounds.bottom = Math.max(bounds.bottom, p.y);
    }
    strokeBounds.set(mark, bounds);
  }
  return bounds;
}
const interpolate = (a: InkPoint, b: InkPoint, t: number): InkPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  pressure: a.pressure + (b.pressure - a.pressure) * t,
  tiltX: (a.tiltX ?? 0) + ((b.tiltX ?? 0) - (a.tiltX ?? 0)) * t,
  tiltY: (a.tiltY ?? 0) + ((b.tiltY ?? 0) - (a.tiltY ?? 0)) * t,
});

/** Cut strokes at the boundary of the eraser swept between two pointer samples. */
export function eraseInk(
  marks: Mark[],
  from: Point,
  to: Point,
  radius: number,
  width: number,
  height: number,
  whole = false,
): Mark[] {
  const sx = (to.x - from.x) * width,
    sy = (to.y - from.y) * height;
  const length = Math.hypot(sx, sy);
  const ux = length ? sx / length : 1,
    uy = length ? sy / length : 0;
  const project = (p: Point) => {
    const x = (p.x - from.x) * width,
      y = (p.y - from.y) * height;
    return { x: x * ux + y * uy, y: y * ux - x * uy };
  };
  const distance = (x: number, y: number) => Math.hypot(x - Math.max(0, Math.min(length, x)), y);
  let changed = false;
  const result = marks.flatMap((mark) => {
    if (!isStroke(mark) || !mark.points.length) {
      const { x, y, w, h } = mark.rect;
      if (whole && to.x >= x && to.x <= x + w && to.y >= y && to.y <= y + h) {
        changed = true;
        return [];
      }
      return [mark];
    }
    const box = boundsFor(mark);
    const padding =
      radius +
      (mark.kind === 'highlight-ink' ? mark.size : pressureWidth(mark.size, 1, mark.penStyle)) / 2;
    if (
      box.right < Math.min(from.x, to.x) - padding / width ||
      box.left > Math.max(from.x, to.x) + padding / width ||
      box.bottom < Math.min(from.y, to.y) - padding / height ||
      box.top > Math.max(from.y, to.y) + padding / height
    )
      return [mark];
    const fragments: InkPoint[][] = [];
    let fragment: InkPoint[] = [];
    let cut = false;
    const close = () => {
      if (fragment.length) fragments.push(fragment);
      fragment = [];
    };
    for (let i = 0; i < Math.max(1, mark.points.length - 1); i++) {
      const a = mark.points[i],
        b = mark.points[i + 1] ?? a;
      const start = project(a),
        end = project(b);
      const dx = end.x - start.x,
        dy = end.y - start.y;
      const strokeWidth =
        mark.kind === 'highlight-ink'
          ? mark.size
          : pressureWidth(mark.size, strokePressure(a, b, mark.penStyle), mark.penStyle);
      const r = radius + strokeWidth / 2;
      const bounds = [0, 1];
      const add = (t: number) => {
        if (t > 0 && t < 1) bounds.push(t);
      };
      if (
        Math.min(start.x, end.x) < length + r &&
        Math.max(start.x, end.x) > -r &&
        Math.min(start.y, end.y) < r &&
        Math.max(start.y, end.y) > -r
      ) {
        if (dy) {
          add((r - start.y) / dy);
          add((-r - start.y) / dy);
        }
        const a2 = dx * dx + dy * dy;
        if (a2)
          for (const center of length ? [0, length] : [0]) {
            const x = start.x - center;
            const b2 = x * dx + start.y * dy;
            const discriminant = b2 * b2 - a2 * (x * x + start.y * start.y - r * r);
            if (discriminant > 0) {
              add((-b2 - Math.sqrt(discriminant)) / a2);
              add((-b2 + Math.sqrt(discriminant)) / a2);
            }
          }
      }
      bounds.sort((a, b) => a - b);
      for (let j = 1; j < bounds.length; j++) {
        const left = bounds[j - 1],
          right = bounds[j];
        if (right - left < 1e-8) continue;
        const middle = (left + right) / 2;
        if (distance(start.x + middle * dx, start.y + middle * dy) < r) {
          cut = true;
          close();
          if (whole) {
            changed = true;
            return [];
          }
        } else {
          if (!fragment.length) fragment.push(left === 0 ? a : interpolate(a, b, left));
          if (a !== b) fragment.push(right === 1 ? b : interpolate(a, b, right));
        }
      }
    }
    if (!cut) return [mark];
    close();
    changed = true;
    return fragments.map((points, i) => ({
      ...mark,
      id: i === 0 ? mark.id : crypto.randomUUID(),
      points,
    }));
  });
  return changed ? result : marks;
}
