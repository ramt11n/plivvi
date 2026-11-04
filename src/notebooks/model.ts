import { get, set, del } from '../lib/storage';
import { deadline } from '../lib/deadline';
import type { Mark } from '../reader/types';
export type Paper = 'blank' | 'ruled' | 'grid' | 'dots' | 'cornell';
export type Notebook = {
  id: string;
  title: string;
  color: string;
  paper: Paper;
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
  for (let i = 0; i < count; i++) {
    const p = pdf.addPage([595.28, 841.89]),
      ink = rgb(0.8, 0.84, 0.9);
    const line = (x1: number, y1: number, x2: number, y2: number) =>
      p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: ink, thickness: 0.45 });
    if (paper === 'ruled' || paper === 'cornell') {
      for (let y = 771; y > 55; y -= 25) line(42, y, 553, y);
      if (paper === 'cornell') {
        line(175, 55, 175, 792);
        line(42, 155, 553, 155);
      } else line(78, 45, 78, 796);
    }
    if (paper === 'grid') {
      for (let x = 42; x < 555; x += 20) line(x, 45, x, 796);
      for (let y = 56; y < 797; y += 20) line(42, y, 553, y);
    }
    if (paper === 'dots')
      for (let x = 48; x < 555; x += 20)
        for (let y = 56; y < 797; y += 20) p.drawCircle({ x, y, size: 0.7, color: ink });
    onProgress?.(i + 1, count);
    if (onProgress && (i % 5 === 0 || i === count - 1))
      await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return pdf.save();
}
