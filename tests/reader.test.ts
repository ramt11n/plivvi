import { beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { sample, open, extractText } from '../src/lib/engine';
import {
  readerOpen,
  readerClose,
  readerRender,
  readerText,
  readerSearch,
  readerAppendPage,
  layoutReaderText,
  exportAnnotations,
} from '../src/reader/engine';
import type { Mark } from '../src/reader/types';
import type { Input, Output } from '../src/lib/client';
const asInput = (o: Output): Input => ({
  name: o.name,
  type: o.type,
  data: new Uint8Array(o.data).buffer,
});
let input: Input;
beforeAll(async () => {
  input = asInput(await sample());
});
describe('PDF reader and portable annotations', () => {
  it('opens a persistent session, renders pages, exposes selectable text, and finds text locations', async () => {
    const info = await readerOpen(input);
    expect(info.count).toBe(3);
    const image = await readerRender(info.session, 0, 600);
    expect(image.data[0]).toBe(137);
    const text = readerText(info.session, 0);
    expect(text.text).toContain('Welcome');
    expect(text.chars.some((c) => c.text === 'W')).toBe(true);
    expect(
      text.chars.filter((c) => c.w > 0).every((c) => Number.isFinite(c.x) && Number.isFinite(c.y)),
    ).toBe(true);
    const hits = readerSearch(info.session, 'Welcome');
    expect(hits[0].page).toBe(0);
    expect(hits[0].quads[0].length).toBe(8);
    readerClose(info.session);
    expect(() => readerText(info.session, 0)).toThrow('closed');
  });
  it('exports native ink with varying pressure widths plus typed text, highlights, and notes', async () => {
    const common = {
        page: 0,
        color: '#6965d8',
        size: 3,
        opacity: 1,
        rect: { x: 0.1, y: 0.6, w: 0.45, h: 0.1 },
        points: [],
      },
      marks: Mark[] = [
        {
          ...common,
          id: 'ink',
          kind: 'ink',
          points: [
            { x: 0.12, y: 0.58, pressure: 0.15 },
            { x: 0.22, y: 0.56, pressure: 0.2 },
            { x: 0.35, y: 0.6, pressure: 0.95 },
            { x: 0.42, y: 0.55, pressure: 1 },
          ],
        },
        {
          ...common,
          id: 'text',
          kind: 'text',
          size: 18,
          text: 'POCKET ANNOTATION TEST',
          rect: { x: 0.1, y: 0.65, w: 0.7, h: 0.08 },
        },
        {
          ...common,
          id: 'highlight',
          kind: 'highlight',
          color: '#e8bc32',
          opacity: 0.3,
          rect: { x: 0.1, y: 0.31, w: 0.7, h: 0.035 },
        },
        {
          ...common,
          id: 'note',
          kind: 'note',
          text: 'Remember to review this page.',
          rect: { x: 0.85, y: 0.15, w: 0.04, h: 0.04 },
        },
      ];
    const out = await exportAnnotations(input, '', marks),
      doc = await open(asInput(out)),
      p = doc.loadPage(0),
      annotations = p.getAnnotations();
    try {
      expect(annotations.some((a) => a.getType() === 'Ink')).toBe(true);
      const widths = annotations
        .filter((a) => a.getType() === 'Ink')
        .map((a) => a.getBorderWidth());
      expect(new Set(widths).size).toBeGreaterThan(1);
      expect(annotations.find((a) => a.getType() === 'FreeText')?.getContents()).toBe(
        'POCKET ANNOTATION TEST',
      );
      expect(annotations.find((a) => a.getType() === 'FreeText')?.getColor()).toEqual([]);
      expect(annotations.find((a) => a.getType() === 'Text')?.getContents()).toContain('Remember');
      const pix = await readerOpen(asInput(out)),
        rendered = await readerRender(pix.session, 0, 850);
      mkdirSync('test-output', { recursive: true });
      writeFileSync('test-output/reader-annotated-native.png', rendered.data);
      readerClose(pix.session);
    } finally {
      annotations.forEach((a) => a.destroy());
      p.destroy();
      doc.destroy();
    }
    expect((await extractText(asInput(out)))[0]).toContain('Welcome');
    mkdirSync('test-output', { recursive: true });
    writeFileSync('test-output/reader-annotated.pdf', out.data);
    const flat = await exportAnnotations(input, '', marks, true),
      flatDoc = await open(asInput(flat)),
      flatPage = flatDoc.loadPage(0),
      remaining = flatPage.getAnnotations();
    try {
      expect(remaining).toHaveLength(0);
    } finally {
      remaining.forEach((a) => a.destroy());
      flatPage.destroy();
      flatDoc.destroy();
    }
    expect((await extractText(asInput(flat)))[0]).toContain('POCKET ANNOTATION TEST');
  });
  it('maps ink to visible coordinates on a rotated, cropped page', async () => {
    const pdf = await PDFDocument.create(),
      p = pdf.addPage([400, 500]);
    p.setCropBox(20, 30, 350, 400);
    p.setRotation(degrees(90));
    const f: Input = {
        name: 'rotated.pdf',
        type: 'application/pdf',
        data: new Uint8Array(await pdf.save()).buffer,
      },
      mark: Mark = {
        id: 'rotated-ink',
        page: 0,
        kind: 'ink',
        color: '#28344b',
        size: 3,
        opacity: 1,
        rect: { x: 0, y: 0, w: 0, h: 0 },
        points: [
          { x: 0.1, y: 0.2, pressure: 0.5 },
          { x: 0.4, y: 0.3, pressure: 0.5 },
        ],
      },
      out = await exportAnnotations(f, '', [mark]),
      doc = await open(asInput(out)),
      page = doc.loadPage(0),
      anns = page.getAnnotations();
    try {
      const b = page.getBounds(),
        points = anns[0].getInkList()[0];
      expect(points[0][0]).toBeCloseTo(b[0] + (b[2] - b[0]) * 0.1);
      expect(points[1][1]).toBeCloseTo(b[1] + (b[3] - b[1]) * 0.3);
    } finally {
      anns.forEach((a) => a.destroy());
      page.destroy();
      doc.destroy();
    }
  });
  it('wraps added text to the same measured lines used by preview and export', async () => {
    const lines = await layoutReaderText(
      'A useful note that needs more than one line on a small page.',
      18,
      140,
    );
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.join(' ')).toContain('useful note');
  });
  it('adds a blank page without losing original text', async () => {
    const out = await readerAppendPage(input),
      doc = await PDFDocument.load(out.data);
    expect(doc.getPageCount()).toBe(4);
    expect((await extractText(asInput(out)))[0]).toContain('Welcome');
  });
});
