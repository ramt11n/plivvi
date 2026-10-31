export type Point = { x: number; y: number };
export type Filter = 'original' | 'clean' | 'gray' | 'bw' | 'vivid';
export function solve(matrix: number[][], values: number[]): number[] {
  const a = matrix.map((r, i) => [...r, values[i]]),
    n = values.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    if (Math.abs(a[i][i]) < 1e-9)
      throw Error('Spread the crop corners apart to make a valid page.');
    const scale = a[i][i];
    for (let k = i; k <= n; k++) a[i][k] /= scale;
    for (let j = 0; j < n; j++)
      if (j !== i) {
        const f = a[j][i];
        for (let k = i; k <= n; k++) a[j][k] -= f * a[i][k];
      }
  }
  return a.map((r) => r[n]);
}
export function perspective(source: ImageData, points: Point[]): ImageData {
  if (points.length !== 4 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    throw Error('Choose four valid page corners.');
  const turns = points.map((a, i) => {
    const b = points[(i + 1) % 4],
      c = points[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  if (
    turns.some((t) => Math.abs(t) < 4) ||
    !turns.every((t) => Math.sign(t) === Math.sign(turns[0]))
  )
    throw Error('Keep the page corners in order without crossing the crop edges.');
  const [tl, tr, br, bl] = points;
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const w = Math.max(32, Math.round((dist(tl, tr) + dist(bl, br)) / 2)),
    h = Math.max(32, Math.round((dist(tl, bl) + dist(tr, br)) / 2));
  const dst = [
      { x: 0, y: 0 },
      { x: w - 1, y: 0 },
      { x: w - 1, y: h - 1 },
      { x: 0, y: h - 1 },
    ],
    m: number[][] = [],
    v: number[] = [];
  dst.forEach(({ x, y }, i) => {
    const u = points[i].x,
      z = points[i].y;
    m.push([x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -z * x, -z * y]);
    v.push(u, z);
  });
  const t = solve(m, v),
    out = new ImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const den = t[6] * x + t[7] * y + 1,
        u = Math.max(0, Math.min(source.width - 1, (t[0] * x + t[1] * y + t[2]) / den)),
        z = Math.max(0, Math.min(source.height - 1, (t[3] * x + t[4] * y + t[5]) / den));
      const x0 = Math.floor(u),
        y0 = Math.floor(z),
        x1 = Math.min(source.width - 1, x0 + 1),
        y1 = Math.min(source.height - 1, y0 + 1),
        fx = u - x0,
        fy = z - y0,
        k = (y * w + x) * 4;
      for (let c = 0; c < 3; c++)
        out.data[k + c] =
          (source.data[(y0 * source.width + x0) * 4 + c] * (1 - fx) +
            source.data[(y0 * source.width + x1) * 4 + c] * fx) *
            (1 - fy) +
          (source.data[(y1 * source.width + x0) * 4 + c] * (1 - fx) +
            source.data[(y1 * source.width + x1) * 4 + c] * fx) *
            fy;
      out.data[k + 3] = 255;
    }
  return out;
}
function blur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(src.length),
    out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[y * w + Math.max(0, Math.min(w - 1, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / (r * 2 + 1);
      sum += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (r * 2 + 1);
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}
export function enhance(
  source: ImageData,
  filter: Filter,
  strength = 0.75,
  brightness = 0,
  contrast = 1,
): ImageData {
  const { width: w, height: h, data: d } = source,
    out = new ImageData(w, h);
  let illum: Float32Array | undefined;
  if (filter === 'clean' || filter === 'bw') {
    const lum = new Float32Array(w * h);
    for (let i = 0; i < lum.length; i++) lum[i] = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    illum = blur(
      blur(lum, w, h, Math.max(4, Math.round(Math.min(w, h) / 40))),
      w,
      h,
      Math.max(4, Math.round(Math.min(w, h) / 40)),
    );
  }
  for (let i = 0; i < w * h; i++) {
    let rgb = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    if (illum)
      rgb = rgb.map(
        (c) => c * (1 - strength) + Math.min(255, (c * 255) / Math.max(40, illum![i])) * strength,
      );
    if (filter === 'gray' || filter === 'bw') {
      const gray = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
      rgb = [gray, gray, gray];
    }
    if (filter === 'bw') rgb = rgb.map((c) => (c > 160 ? 255 : Math.max(0, c - 70)));
    if (filter === 'vivid') {
      const avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
      rgb = rgb.map((c) => avg + (c - avg) * 1.35);
    }
    for (let c = 0; c < 3; c++)
      out.data[i * 4 + c] = Math.max(
        0,
        Math.min(255, (rgb[c] - 128) * contrast + 128 + brightness),
      );
    out.data[i * 4 + 3] = 255;
  }
  return out;
}
export function detectCorners(source: ImageData): Point[] {
  const { width: w, height: h, data: d } = source,
    scale = Math.max(1, Math.max(w, h) / 450),
    sw = Math.ceil(w / scale),
    sh = Math.ceil(h / scale),
    lum = new Uint8Array(sw * sh),
    hist = new Uint32Array(256),
    border: number[] = [];
  const fallback = () => [
    { x: w * 0.05, y: h * 0.05 },
    { x: w * 0.95, y: h * 0.05 },
    { x: w * 0.95, y: h * 0.95 },
    { x: w * 0.05, y: h * 0.95 },
  ];
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const sx = Math.min(w - 1, Math.floor(x * scale)),
        sy = Math.min(h - 1, Math.floor(y * scale)),
        i = (sy * w + sx) * 4,
        v = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      lum[y * sw + x] = v;
      hist[v]++;
      if (x < sw * 0.025 || x > sw * 0.975 || y < sh * 0.025 || y > sh * 0.975) border.push(v);
    }
  border.sort((a, b) => a - b);
  const background = border[Math.floor(border.length / 2)];
  let total = 0,
    bright = 255;
  for (let i = 0; i < 256; i++) {
    total += hist[i];
    if (total > lum.length * 0.9) {
      bright = i;
      break;
    }
  }
  // Estimate paper against the surrounding surface, allowing shaded paper to remain part of the page.
  if (bright - background < 30) return fallback();
  const threshold = background + (bright - background) * 0.28,
    seen = new Uint8Array(lum.length),
    queue = new Int32Array(lum.length);
  let best: number[] = [];
  for (let start = 0; start < lum.length; start++) {
    if (seen[start] || lum[start] <= threshold) continue;
    let head = 0,
      tail = 1;
    queue[0] = start;
    seen[start] = 1;
    const region: number[] = [];
    while (head < tail) {
      const i = queue[head++],
        x = i % sw,
        y = Math.floor(i / sw);
      region.push(i);
      for (const n of [
        x ? i - 1 : -1,
        x < sw - 1 ? i + 1 : -1,
        y ? i - sw : -1,
        y < sh - 1 ? i + sw : -1,
      ])
        if (n >= 0 && !seen[n] && lum[n] > threshold) {
          seen[n] = 1;
          queue[tail++] = n;
        }
    }
    if (region.length > best.length) best = region;
  }
  if (best.length < lum.length * 0.12 || best.length > lum.length * 0.95) return fallback();
  const pts = best.map((i) => ({
    x: Math.min(w - 1, (i % sw) * scale),
    y: Math.min(h - 1, Math.floor(i / sw) * scale),
  }));
  const extreme = (f: (p: Point) => number) => pts.reduce((a, b) => (f(b) < f(a) ? b : a));
  const corners = [
    extreme((p) => p.x + p.y),
    extreme((p) => -p.x + p.y),
    extreme((p) => -p.x - p.y),
    extreme((p) => p.x - p.y),
  ];
  return corners.every(
    (p, i) =>
      Math.hypot(p.x - corners[(i + 1) % 4].x, p.y - corners[(i + 1) % 4].y) >
      Math.min(w, h) * 0.15,
  )
    ? corners
    : fallback();
}
export async function loadImage(file: Blob, max = 2000) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error('This image could not be exported.'))),
      type,
      quality,
    ),
  );
}
