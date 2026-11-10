import { expect, it, vi } from 'vitest';
const memory = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../src/lib/storage', () => ({
  get: vi.fn(async (key: string) => memory.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    memory.set(key, structuredClone(value));
  }),
  del: vi.fn(async (key: string) => {
    memory.delete(key);
  }),
}));
import {
  changeNotebook,
  readNotebooks,
  saveNotebookDraft,
  type Notebook,
} from '../src/notebooks/model';
import type { Mark } from '../src/reader/types';
it('restores notebook pages and ink independently, isolates accounts, and clears removed drafts', async () => {
  const original: Notebook = {
    id: 'book',
    title: 'ایده‌ها',
    paper: 'grid',
    color: '#3659e3',
    data: new Uint8Array([1]),
    marks: [],
    created: '2026-01-01',
    updated: '2026-01-01',
  };
  await changeNotebook('account-a', () => [original]);
  const marks: Mark[] = [
    {
      id: 'ink',
      page: 1,
      kind: 'ink',
      size: 2,
      color: '#3659e3',
      opacity: 1,
      points: [{ x: 0.1, y: 0.2, pressure: 0.6 }],
      rect: { x: 0.1, y: 0.2, w: 0, h: 0 },
    },
  ];
  await saveNotebookDraft('account-a', 'book', marks, new Uint8Array([2, 3]).buffer);
  await saveNotebookDraft('account-a', 'book', [], undefined);
  expect((await readNotebooks('account-a'))[0]).toMatchObject({
    data: new Uint8Array([2, 3]),
    marks: [],
  });
  expect(await readNotebooks('account-b')).toEqual([]);
  await changeNotebook('account-a', (books) => books.map((b) => ({ ...b, title: 'Renamed' })));
  expect((await readNotebooks('account-a'))[0].data).toEqual(new Uint8Array([2, 3]));
  await changeNotebook('account-a', () => []);
  expect(await readNotebooks('account-a')).toEqual([]);
  expect([...memory.keys()].some((k) => k.includes(':ink:') || k.includes(':pages:'))).toBe(false);
});

it('reports generated page counts without treating PDF preparation as timed progress', async () => {
  const { notebookPDF } = await import('../src/notebooks/model');
  const progress = vi.fn();
  const data = await notebookPDF('ruled', 3, progress);
  expect(progress.mock.calls).toEqual([
    [0, 3],
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
  const { PDFDocument } = await import('pdf-lib');
  expect((await PDFDocument.load(data)).getPageCount()).toBe(3);
});

it('embeds custom RGB paper and mirrors the Cornell divider for RTL', async () => {
  const { notebookPDF } = await import('../src/notebooks/model');
  const { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } = await import('pdf-lib');
  const data = await notebookPDF('cornell', 1, undefined, {
    pageColor: '#00ff00',
    lineColor: '#ff0000',
    spacing: 34,
    direction: 'rtl',
  });
  const pdf = await PDFDocument.load(data);
  const contents = pdf.getPage(0).node.Contents();
  if (!(contents instanceof PDFArray)) throw Error('Expected a notebook page content array');
  const operators = Array.from({ length: contents.size() }, (_, i) =>
    new TextDecoder().decode(decodePDFRawStream(contents.lookup(i, PDFRawStream)).decode()),
  ).join('\n');
  expect(operators).toContain('0 1 0 rg');
  expect(operators).toContain('1 0 0 RG');
  expect(operators).toContain('420.28 55 m');
  expect(operators).toContain('737 m');
});
