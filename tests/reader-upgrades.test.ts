import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { comicPDF } from '../src/reader/comic';
import { fetchReaderFile } from '../src/reader/sources';
import { eraseInk } from '../src/reader/eraseInk';
import { patternLine, refineShape } from '../src/reader/shapes';
import type { Mark } from '../src/reader/types';
import { sampleComic } from './fixtures/sampleComic';

afterEach(() => vi.unstubAllGlobals());
const point = (x: number, y: number) => ({ x, y, pressure: 0.6 });
const stroke: Mark = {
  id: 'line',
  page: 0,
  kind: 'ink',
  points: [point(0.1, 0.5), point(0.9, 0.5)],
  color: '#202020',
  size: 2,
  opacity: 1,
  rect: { x: 0, y: 0, w: 0, h: 0 },
};

it('unpacks a real CBR, ignores Mac metadata, and sorts 1, 2, 10 naturally', async () => {
  const wasm = await readFile(
    new URL('../node_modules/libarchive-wasm/dist/libarchive.wasm', import.meta.url),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array(wasm))),
  );
  const input = {
    name: 'comic.cbr',
    type: 'application/vnd.comicbook-rar',
    data: new Uint8Array(sampleComic()).buffer,
  };
  const output = await comicPDF(input, vi.fn());
  expect(output.name).toBe('comic.pdf');
  const pdf = await PDFDocument.load(output.data);
  expect(pdf.getPages().map((p) => p.getSize())).toEqual([
    { width: 720, height: 960 },
    { width: 960, height: 480 },
    { width: 480, height: 960 },
  ]);
});

it('detects the format from bytes of an HTTPS download and omits cookies', async () => {
  const fetch = vi.fn(async () => new Response(new Uint8Array(sampleComic())));
  vi.stubGlobal('fetch', fetch);
  const signal = new AbortController().signal;
  const file = await fetchReaderFile('https://example.com/download?id=5', signal, vi.fn());
  expect(file.name).toBe('download.cbr');
  expect(fetch).toHaveBeenCalledWith(expect.any(URL), {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  await expect(fetchReaderFile('http://example.com/comic.cbr', signal, vi.fn())).rejects.toThrow(
    'HTTPS',
  );
});

it('cuts a sparse stroke at both sides of a fast eraser sweep', () => {
  const chunks = eraseInk([stroke], point(0.5, 0.3), point(0.5, 0.7), 10, 100, 100);
  expect(chunks).toHaveLength(2);
  expect(chunks[0].points[0]).toEqual(stroke.points[0]);
  expect(chunks[0].points.at(-1)!.x).toBeLessThan(0.4);
  expect(chunks[1].points[0].x).toBeGreaterThan(0.6);
  expect(chunks[1].points.at(-1)).toEqual(stroke.points[1]);
  expect(eraseInk([stroke], point(0.5, 0.3), point(0.5, 0.7), 10, 100, 100, true)).toEqual([]);
});

it('refines rough closed boxes and leaves unrelated open doodles alone', () => {
  const box = [
    point(0.2, 0.2),
    point(0.4, 0.21),
    point(0.61, 0.2),
    point(0.6, 0.4),
    point(0.59, 0.6),
    point(0.2, 0.61),
    point(0.21, 0.41),
    point(0.2, 0.22),
  ];
  const refined = refineShape(box, 600, 800, 'auto');
  expect(refined).toHaveLength(5);
  expect(refined[0]).toEqual(refined[4]);
  const doodle = [point(0.2, 0.2), point(0.25, 0.5), point(0.4, 0.24), point(0.7, 0.6)];
  expect(refineShape(doodle, 600, 800, 'auto')).toBe(doodle);
  const line = refineShape(doodle, 600, 800, 'line');
  expect(line).toEqual([doodle[0], doodle.at(-1)]);
  expect(patternLine(line, 'dot', 4, 600, 800).every((segment) => segment.length === 1)).toBe(true);
});
