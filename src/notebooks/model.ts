import { get, set, del } from '../lib/storage';
import { deadline } from '../lib/deadline';
import type { Mark } from '../reader/types';
import { hexColor } from '../reader/types';
export const paperStyles = [
  ['ruled', 'Ruled'],
  ['dashed', 'Dashed'],
  ['handwriting', 'Handwriting'],
  ['dots', 'Dotted'],
  ['grid', 'Grid'],
  ['cornell', 'Cornell'],
  ['blank', 'Blank'],
] as const;
export type Paper = (typeof paperStyles)[number][0];
export type PaperSettings = {
  pageColor: string;
  lineColor: string;
  spacing: number;
  direction: 'ltr' | 'rtl';
};
export const defaultPaper: PaperSettings = {
  pageColor: '#ffffff',
  lineColor: '#ccd6e6',
  spacing: 25,
  direction: 'ltr',
};
export type Notebook = {
  id: string;
  title: string;
  color: string;
  paper: Paper;
  paperSettings?: PaperSettings;
  data: Uint8Array;
  marks: Mark[];
  updated: string;
  created: string;
};
const key = (workspace: string) => `plivvi-notebooks:${workspace}`;
const queues = new Map<string, Promise<unknown>>();
export async function readNotebooks(workspace: string): Promise<Notebook[]> {
  const books = (await get<Notebook[]>(key(workspace))) ?? [];
  return Promise.all(
    books.map(async (book) => {
      const [draft, data] = await Promise.all([
        get<{ marks: Mark[]; updated: string }>(`${key(workspace)}:ink:${book.id}`),
        get<Uint8Array>(`${key(workspace)}:pages:${book.id}`),
      ]);
      return {
        ...book,
        ...(data ? { data } : {}),
        ...(draft
          ? {
              marks: draft.marks,
              updated: draft.updated > book.updated ? draft.updated : book.updated,
            }
          : {}),
      };
    }),
  );
}
export async function saveNotebookDraft(
  workspace: string,
  id: string,
  marks: Mark[],
  source?: ArrayBuffer,
) {
  // Ink autosave avoids rewriting every notebook or a large imported PDF per stroke.
  const pending = (queues.get(workspace) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      if (source) await set(`${key(workspace)}:pages:${id}`, new Uint8Array(source));
      const updated = new Date().toISOString();
      await set(`${key(workspace)}:ink:${id}`, { marks, updated });
      return updated;
    });
  queues.set(workspace, pending);
  pending
    .finally(() => {
      if (queues.get(workspace) === pending) queues.delete(workspace);
    })
    .catch(() => {});
  return pending;
}
export function changeNotebook(
  workspace: string,
  update: (books: Notebook[]) => Notebook[],
): Promise<Notebook[]> {
  const pending = (queues.get(workspace) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const previous = await readNotebooks(workspace),
        next = update(previous);
      await set(key(workspace), next);
      await Promise.all(
        previous
          .filter((book) => !next.some((b) => b.id === book.id))
          .flatMap((book) => [
            del(`${key(workspace)}:ink:${book.id}`),
            del(`${key(workspace)}:pages:${book.id}`),
          ]),
      );
      return next;
    });
  queues.set(workspace, pending);
  pending
    .finally(() => {
      if (queues.get(workspace) === pending) queues.delete(workspace);
    })
    .catch(() => {});
  return pending;
}
export async function notebookPDF(
  paper: Paper,
  count = 1,
  onProgress?: (completed: number, total: number) => void,
  settings: PaperSettings = defaultPaper,
): Promise<Uint8Array> {
  if (!Number.isInteger(count) || count < 1 || count > 300)
    throw Error('Choose between 1 and 300 pages.');
  const { PDFDocument, rgb } = await deadline(
      import('pdf-lib'),
      20000,
      'The notebook editor could not load. Check your connection, reload, and try again.',
    ),
    pdf = await PDFDocument.create();
  onProgress?.(0, count);
  const spacing = Number.isFinite(settings.spacing)
    ? Math.max(12, Math.min(40, settings.spacing))
    : 25;
  const rtl = settings.direction === 'rtl';
  const mirror = (x: number) => (rtl ? 595.28 - x : x);
  const ink = rgb(...hexColor(settings.lineColor));
  for (let i = 0; i < count; i++) {
    const p = pdf.addPage([595.28, 841.89]);
    if (settings.pageColor !== '#ffffff')
      p.drawRectangle({
        x: 0,
        y: 0,
        width: 595.28,
        height: 841.89,
        color: rgb(...hexColor(settings.pageColor)),
      });
    const line = (x1: number, y1: number, x2: number, y2: number, dashed = false) =>
      p.drawLine({
        start: { x: mirror(x1), y: y1 },
        end: { x: mirror(x2), y: y2 },
        color: ink,
        thickness: 0.55,
        dashArray: dashed ? [4, 3] : undefined,
      });
    if (['ruled', 'cornell', 'dashed', 'handwriting'].includes(paper)) {
      for (let y = 771; y > (paper === 'cornell' ? 165 : 55); y -= spacing) {
        line(42, y, 553, y, paper === 'dashed');
        if (paper === 'handwriting') {
          line(42, y - spacing / 3, 553, y - spacing / 3, true);
          line(42, y - (spacing * 2) / 3, 553, y - (spacing * 2) / 3);
        }
      }
      if (paper === 'cornell') {
        line(175, 55, 175, 792);
        line(42, 155, 553, 155);
      } else line(78, 45, 78, 796);
    }
    if (paper === 'grid') {
      for (let x = 42; x < 555; x += spacing) line(x, 45, x, 796);
      for (let y = 56; y < 797; y += spacing) line(42, y, 553, y);
    }
    if (paper === 'dots')
      for (let x = 48; x < 555; x += spacing)
        for (let y = 56; y < 797; y += spacing)
          p.drawCircle({ x: mirror(x), y, size: 0.7, color: ink });
    onProgress?.(i + 1, count);
    if (onProgress && (i % 5 === 0 || i === count - 1))
      await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return pdf.save();
}
