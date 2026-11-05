// Preserve the real reader screenshot with two projective screen planes.
import { readFile, writeFile } from 'node:fs/promises';
const base = 'public/visuals/showcase/';
const frame = (await readFile(base + 'reader-frame.webp')).toString('base64');
const screen = (await readFile(base + 'reader-ui.webp')).toString('base64');

function solve(a, b) {
  const rows = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < b.length; col++) {
    let pivot = col;
    for (let row = col + 1; row < b.length; row++)
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const d = rows[col][col];
    rows[col] = rows[col].map((v) => v / d);
    for (let row = 0; row < b.length; row++) {
      if (row === col) continue;
      const f = rows[row][col];
      rows[row] = rows[row].map((v, i) => v - f * rows[col][i]);
    }
  }
  return rows.map((row) => row.at(-1));
}
function projection(from, to) {
  const a = [],
    b = [];
  from.forEach(([x, y], i) => {
    const [u, v] = to[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(u, v);
  });
  const h = solve(a, b);
  return ([x, y]) => {
    const d = h[6] * x + h[7] * y + 1;
    return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
  };
}
const halves = [
  {
    source: [
      [0, 0],
      [360, 0],
      [360, 560],
      [0, 560],
    ],
    target: [
      [134, 54],
      [712, 153],
      [712, 989],
      [134, 961],
    ],
  },
  {
    source: [
      [360, 0],
      [720, 0],
      [720, 560],
      [360, 560],
    ],
    target: [
      [712, 153],
      [1317, 67],
      [1317, 961],
      [712, 989],
    ],
  },
];
const parts = [];
let id = 0;
for (const { source, target } of halves) {
  const project = projection(source, target);
  const x0 = source[0][0];
  const columns = 12,
    rows = 16;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const x = x0 + (col * 360) / columns,
        y = (row * 560) / rows,
        dx = 360 / columns,
        dy = 560 / rows;
      const corners = [
        [x, y],
        [x + dx, y],
        [x + dx, y + dy],
        [x, y + dy],
      ];
      for (const indices of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const src = indices.map((i) => corners[i]),
          dst = src.map(project);
        const xs = solve(
          src.map(([a, b]) => [a, b, 1]),
          dst.map((p) => p[0]),
        );
        const ys = solve(
          src.map(([a, b]) => [a, b, 1]),
          dst.map((p) => p[1]),
        );
        const center = dst.reduce((a, p) => [a[0] + p[0] / 3, a[1] + p[1] / 3], [0, 0]);
        const overlap = dst.map((p) => {
          const d = Math.hypot(p[0] - center[0], p[1] - center[1]);
          return p.map((v, i) => v + ((v - center[i]) * 0.45) / d);
        });
        parts.push(
          `<clipPath id="t${id}"><polygon points="${overlap.map((p) => p.join(',')).join(' ')}"/></clipPath><g clip-path="url(#t${id++})"><use href="#screen" transform="matrix(${[xs[0], ys[0], xs[1], ys[1], xs[2], ys[2]].join(' ')})"/></g>`,
        );
      }
    }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1433" height="1098" viewBox="0 0 1433 1098"><defs><image id="screen" width="720" height="560" href="data:image/webp;base64,${screen}"/><clipPath id="display"><path d="M176 54 Q134 50 134 96 V918 Q134 960 177 964 L712 989 L1274 963 Q1317 961 1317 920 V111 Q1317 64 1274 68 L712 153 Z"/></clipPath></defs><image width="1433" height="1098" href="data:image/webp;base64,${frame}"/><g clip-path="url(#display)">${parts.join('')}</g></svg>`;
await writeFile(base + 'reader-device.svg', svg);
console.log('Created folded device artwork with two perspective-correct screen planes.');
