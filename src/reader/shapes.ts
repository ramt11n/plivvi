import type { InkPoint } from './types';

export type LinePattern = 'solid' | 'dash' | 'dot';
export type ShapeStyle = 'auto' | 'rectangle' | 'ellipse' | 'triangle';
type Point = Pick<InkPoint, 'x' | 'y'>;
const length = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (a: Point, b: Point, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1);
  return length(p, mix(a, b, Math.min(1, Math.max(0, t))));
}

export function refineShape(
  points: InkPoint[],
  width: number,
  height: number,
  style: ShapeStyle | 'line',
) {
  if (points.length < 2) return points;
  const samples = points.map((p) => ({ x: p.x * width, y: p.y * height }));
  const first = samples[0],
    last = samples.at(-1)!;
  const finish = (result: Point[]) =>
    result.map(({ x, y }) => ({ x: x / width, y: y / height, pressure: 0.6 }));
  if (style === 'line') return finish([first, last]);
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  let travel = 0;
  samples.forEach((p, i) => {
    left = Math.min(left, p.x);
    right = Math.max(right, p.x);
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y);
    if (i) travel += length(samples[i - 1], p);
  });
  const w = right - left,
    h = bottom - top,
    diagonal = Math.hypot(w, h);
  if (diagonal < 5) return points;
  if (style === 'auto' && length(first, last) > diagonal * 0.24) {
    return length(first, last) > travel * 0.8 &&
      samples.every((p) => distanceToSegment(p, first, last) < diagonal * 0.13)
      ? finish([first, last])
      : points;
  }
  if (Math.min(w, h) < 3) return finish([first, last]);
  const box = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  const ellipse = Array.from({ length: 64 }, (_, i) => ({
    x: left + (w * (1 + Math.cos((i * Math.PI) / 32))) / 2,
    y: top + (h * (1 + Math.sin((i * Math.PI) / 32))) / 2,
  }));
  const apex = (a: Point, b: Point, c: Point) => [a, b, c];
  const triangles = [
    apex(mix(box[0], box[1], 0.5), box[2], box[3]),
    apex(mix(box[2], box[3], 0.5), box[0], box[1]),
    apex(mix(box[3], box[0], 0.5), box[1], box[2]),
    apex(mix(box[1], box[2], 0.5), box[3], box[0]),
  ];
  const sampleError = (candidate: Point[]) => {
    let error = 0;
    const step = Math.max(1, Math.floor(samples.length / 100));
    for (let i = 0; i < samples.length; i += step) {
      let distance = Infinity;
      candidate.forEach((p, j) => {
        distance = Math.min(
          distance,
          distanceToSegment(samples[i], p, candidate[(j + 1) % candidate.length]),
        );
      });
      error += distance * distance;
    }
    return Math.sqrt(error / Math.ceil(samples.length / step)) / diagonal;
  };
  const candidates =
    style === 'rectangle'
      ? [box]
      : style === 'ellipse'
        ? [ellipse]
        : style === 'triangle'
          ? triangles
          : [box, ...triangles, ellipse];
  const ranked = candidates
    .map((vertices) => ({ vertices, error: sampleError(vertices) }))
    .sort((a, b) => a.error - b.error);
  const best = ranked[0];
  if (style === 'auto' && best.error > 0.085) return points;
  return finish([...best.vertices, best.vertices[0]]);
}

export function patternLine(
  points: InkPoint[],
  pattern: LinePattern,
  size: number,
  width: number,
  height: number,
) {
  if (pattern === 'solid' || points.length < 2) return [points];
  const a = points[0],
    b = points.at(-1)!;
  const total = Math.hypot((b.x - a.x) * width, (b.y - a.y) * height);
  if (total < 1) return [points];
  const run = pattern === 'dot' ? 0 : Math.max(4, size * 3);
  const step = run + Math.max(3, size * 2.6, total / 300);
  const at = (t: number): InkPoint => ({ ...mix(a, b, t / total), pressure: 0.6 });
  const pieces: InkPoint[][] = [];
  for (let start = 0; start <= total; start += step)
    pieces.push(run ? [at(start), at(Math.min(total, start + run))] : [at(start)]);
  return pieces;
}
