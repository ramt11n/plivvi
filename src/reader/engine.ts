import { mu, open, render } from '../lib/engine';
import type { Input, Output } from '../lib/client';
import {
  hexColor,
  pressureWidth,
  type Mark,
  type ReaderInfo,
  type TextChar,
  type OutlineEntry,
} from './types';
const sessions = new Map<string, Awaited<ReturnType<typeof open>>>();
function get(id: string) {
  const doc = sessions.get(id);
  if (!doc) throw Error('The reader session has closed. Open your PDF again.');
  return doc;
}
export async function readerOpen(input: Input, password = ''): Promise<ReaderInfo> {
  for (const [id, doc] of sessions) {
    doc.destroy();
    sessions.delete(id);
  }
  const doc = await open(input, password),
    session = crypto.randomUUID(),
    pages = [];
  sessions.set(session, doc);
  for (let i = 0; i < doc.countPages(); i++) {
    const p = doc.loadPage(i);
    try {
      const b = p.getBounds();
      pages.push({ width: b[2] - b[0], height: b[3] - b[1] });
    } finally {
      p.destroy();
    }
  }
  const outline: OutlineEntry[] = [];
  function walk(items: any[], level = 0) {
    for (const item of items ?? []) {
      let page = item.page ?? -1;
      if (page < 0 && item.uri)
        try {
          page = doc.resolveLink(item.uri);
        } catch {}
      if (page >= 0) outline.push({ title: item.title ?? 'Untitled section', page, level });
      if (item.down) walk(item.down, level + 1);
    }
  }
  walk(doc.loadOutline() ?? []);
  return {
    session,
    count: pages.length,
    pages,
    outline,
    title: doc.getMetaData('info:Title') ?? input.name,
    author: doc.getMetaData('info:Author') ?? '',
  };
}
export function readerClose(session: string) {
  sessions.get(session)?.destroy();
  sessions.delete(session);
  return true;
}
export async function readerAppendPage(input: Input, password = ''): Promise<Output> {
  const doc = await open(input, password);
  try {
    if (doc.countPages() >= 300)
      throw Error('This document has reached the 300-page browser limit.');
    const last = doc.loadPage(doc.countPages() - 1);
    let bounds;
    try {
      bounds = last.getBounds();
    } finally {
      last.destroy();
    }
    const page = doc.addPage([0, 0, bounds[2] - bounds[0], bounds[3] - bounds[1]], 0, {}, '');
    try {
      doc.insertPage(-1, page);
    } finally {
      page.destroy();
    }
    const buffer = doc.saveToBuffer('garbage=compact,compress=yes');
    try {
      return {
        name: input.name,
        data: new Uint8Array(buffer.asUint8Array()),
        type: 'application/pdf',
      };
    } finally {
      buffer.destroy();
    }
  } finally {
    doc.destroy();
  }
}
export async function readerRender(session: string, index: number, width: number) {
  const doc = get(session);
  if (index < 0 || index >= doc.countPages()) throw Error('That page does not exist.');
  return render(doc, index, Math.min(2400, width), false);
}
export function readerText(session: string, index: number) {
  const p = get(session).loadPage(index);
  try {
    const b = p.getBounds(),
      w = b[2] - b[0],
      h = b[3] - b[1],
      t = p.toStructuredText('preserve-whitespace'),
      chars: TextChar[] = [];
    try {
      t.walk({
        onChar(c, origin, font, size, q) {
          font.destroy();
          if (chars.length > 40000) return;
          const xs = [q[0], q[2], q[4], q[6]],
            ys = [q[1], q[3], q[5], q[7]],
            x = Math.min(...xs),
            y = Math.min(...ys);
          chars.push({
            text: c,
            x: (x - b[0]) / w,
            y: (y - b[1]) / h,
            w: (Math.max(...xs) - x) / w,
            h: (Math.max(...ys) - y) / h,
            size,
          });
        },
        endLine() {
          chars.push({ text: '\n', x: 0, y: 0, w: 0, h: 0, size: 0 });
        },
      });
      return { chars, text: t.asText() };
    } finally {
      t.destroy();
    }
  } finally {
    p.destroy();
  }
}
export function readerSearch(session: string, query: string) {
  if (!query.trim()) return [];
  const doc = get(session),
    results = [];
  for (let i = 0; i < doc.countPages(); i++) {
    const p = doc.loadPage(i);
    try {
      const bounds = p.getBounds(),
        hits = p.search(query, {});
      if (hits.length)
        results.push({
          page: i,
          count: hits.length,
          quads: hits
            .slice(0, 100)
            .flat()
            .map((q) =>
              q.map((v, j) => (v - bounds[j % 2]) / (bounds[(j % 2) + 2] - bounds[j % 2])),
            ),
        });
    } finally {
      p.destroy();
    }
  }
  return results;
}
export async function layoutReaderText(text: string, size: number, width: number) {
  const m = await mu(),
    font = new m.Font('Helvetica');
  try {
    const measure = (s: string) =>
        Array.from(s).reduce(
          (sum, c) => sum + font.advanceGlyph(font.encodeCharacter(c.codePointAt(0)!), 0) * size,
          0,
        ),
      lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/(?<=\s)/u)) {
        if (line && measure(line + word) > width - 5) {
          lines.push(line.trimEnd());
          line = '';
        }
        for (const character of word) {
          if (line && measure(line + character) > width - 5) {
            lines.push(line.trimEnd());
            line = '';
          }
          line += character;
        }
      }
      lines.push(line.trimEnd());
    }
    return lines;
  } finally {
    font.destroy();
  }
}
export async function exportAnnotations(
  input: Input,
  password: string,
  marks: Mark[],
  flatten = false,
): Promise<Output> {
  if (marks.length > 2000) throw Error('Export this document before adding more marks.');
  const m = await mu(),
    doc = await open(input, password);
  try {
    for (const mark of marks) {
      if (mark.page < 0 || mark.page >= doc.countPages())
        throw Error('An annotation refers to a missing page.');
      const p = doc.loadPage(mark.page);
      try {
        const b = p.getBounds(),
          w = b[2] - b[0],
          h = b[3] - b[1],
          color = hexColor(mark.color),
          size = Math.max(0.2, Math.min(60, mark.size)),
          r = mark.rect;
        if (mark.kind === 'ink') {
          const buckets = new Map<number, number[][][]>();
          if (mark.points.length === 1)
            mark.points = [mark.points[0], { ...mark.points[0], x: mark.points[0].x + 0.0001 }];
          for (let i = 1; i < mark.points.length; i++) {
            const a = mark.points[i - 1],
              z = mark.points[i],
              pressure = Math.round(Math.max(0, Math.min(1, (a.pressure + z.pressure) / 2)) * 7),
              paths = buckets.get(pressure) ?? [];
            paths.push([
              [b[0] + a.x * w, b[1] + a.y * h],
              [b[0] + z.x * w, b[1] + z.y * h],
            ]);
            buckets.set(pressure, paths);
          }
          for (const [pressure, paths] of buckets) {
            const a = p.createAnnotation('Ink');
            try {
              a.setName(`Pocket-${mark.id}-${pressure}`);
              a.setAuthor('Pocket PDF Workshop');
              a.setColor(color);
              a.setOpacity(mark.opacity);
              a.setBorderWidth(pressureWidth(size, pressure / 7));
              a.setInkList(paths as [number, number][][]);
              a.setFlags(a.getFlags() | m.PDFAnnotation.IS_PRINT);
              a.setContents('Handwritten ink');
              a.update();
            } finally {
              a.destroy();
            }
          }
        } else {
          const type = mark.kind === 'text' ? 'FreeText' : mark.kind === 'note' ? 'Text' : 'Square',
            a = p.createAnnotation(type);
          try {
            a.setName(`Pocket-${mark.id}`);
            a.setAuthor('Pocket PDF Workshop');
            if (mark.kind !== 'text') a.setColor(color);
            a.setOpacity(mark.opacity);
            a.setRect([
              b[0] + r.x * w,
              b[1] + r.y * h,
              b[0] + (r.x + r.w) * w,
              b[1] + (r.y + r.h) * h,
            ]);
            a.setFlags(a.getFlags() | m.PDFAnnotation.IS_PRINT);
            if (mark.kind === 'text') {
              const lines = await layoutReaderText(mark.text ?? '', size, r.w * w);
              a.setRect([
                b[0] + r.x * w,
                b[1] + r.y * h,
                b[0] + (r.x + r.w) * w,
                b[1] +
                  Math.min(h, (r.y + r.h) * h + Math.max(0, lines.length * size * 1.25 - r.h * h)),
              ]);
              a.setBorderWidth(0);
              a.setDefaultAppearance('Helv', size, color);
              a.setContents(lines.join('\n'));
            } else if (mark.kind === 'note') {
              a.setIcon('Comment');
              a.setContents(mark.text ?? '');
            } else if (mark.kind === 'highlight') {
              a.setInteriorColor(color);
              a.setBorderWidth(0);
            } else a.setBorderWidth(size);
            a.update();
          } finally {
            a.destroy();
          }
        }
        p.update();
      } finally {
        p.destroy();
      }
    }
    if (flatten) doc.bake(true, true);
    const buffer = doc.saveToBuffer('garbage=compact,compress=yes');
    try {
      return {
        name: input.name.replace(/\.pdf$/i, '') + '-annotated.pdf',
        data: new Uint8Array(buffer.asUint8Array()),
        type: 'application/pdf',
      };
    } finally {
      buffer.destroy();
    }
  } finally {
    doc.destroy();
  }
}
