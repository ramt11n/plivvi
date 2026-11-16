import { readFile } from './readFile';
export type Input = { name: string; data: ArrayBuffer; type: string; file?: File };
export type Output = { name: string; data: Uint8Array; type: string };
export type Preview = {
  count: number;
  pages: { index: number; width: number; height: number; png: Uint8Array }[];
  fields?: { name: string; type: string; value: string; options?: string[]; readOnly?: boolean }[];
  title?: string;
};
let worker: Worker;
let seq = 0;
const pending = new Map<
  number,
  {
    resolve: (v: any) => void;
    reject: (e: Error) => void;
    progress?: (s: string, percent?: number) => void;
    output?: (output: Output) => void;
    op: string;
    payload: any;
    retries: number;
    delivered?: boolean;
  }
>();
export function rpc<T = any>(
  op: string,
  payload: any,
  onProgress?: (s: string, percent?: number) => void,
  onOutput?: (output: Output) => void,
): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    const instance = worker;
    worker.onmessage = ({ data: r }) => {
      const p = pending.get(r.id);
      if (!p) return;
      if (r.output) {
        p.delivered = true;
        p.output?.(r.output);
        return;
      }
      if (r.progress) {
        p.progress?.(r.progress, r.percent);
        return;
      }
      pending.delete(r.id);
      r.error ? p.reject(new Error(r.error)) : p.resolve(r.result);
    };
    worker.onmessageerror = () =>
      failWorker(instance, 'The browser could not receive the converted file.');
    worker.onerror = (event) => {
      event.preventDefault();
      failWorker(instance, event.message || 'The document engine could not start.');
    };
  }
  function failWorker(instance: Worker, reason: string) {
    if (worker !== instance) return;
    const interrupted = [...pending.values()];
    pending.clear();
    instance.onmessage = instance.onerror = instance.onmessageerror = null;
    instance.terminate();
    worker = undefined as any;
    for (const p of interrupted) {
      // Retry immutable jobs once with a fresh worker. Reader session IDs cannot survive a reset.
      if (
        !p.retries &&
        !p.delivered &&
        !['reader-render', 'reader-text', 'reader-search', 'reader-close'].includes(p.op)
      ) {
        p.progress?.('Reconnecting the document engine…', undefined);
        rpc(p.op, p.payload, p.progress, p.output).then(p.resolve, p.reject);
        const retried = pending.get(seq);
        if (retried) retried.retries = 1;
      } else
        p.reject(
          new Error(
            `The document engine was interrupted. Retry the operation or reopen the document. ${reason}`,
          ),
        );
    }
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, {
      resolve,
      reject,
      progress: onProgress,
      output: onOutput,
      op,
      payload,
      retries: 0,
    });
    try {
      worker.postMessage({ id, op, payload });
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}
export async function inputs(
  files: File[],
  onProgress?: (percent: number) => void,
  fileBacked = true,
): Promise<Input[]> {
  const total = files.reduce((n, f) => n + f.size, 0) || 1;
  let completed = 0;
  const result: Input[] = [];
  for (const f of files) {
    if (fileBacked && /\.(pdf|cbz|epub|xps|oxps)$/i.test(f.name)) {
      result.push({
        name: f.name,
        type: f.type || 'application/pdf',
        data: new ArrayBuffer(0),
        file: f,
      });
      completed += f.size;
      onProgress?.((completed / total) * 100);
      continue;
    }
    const data = await readFile(f, (p) =>
      onProgress?.(((completed + (f.size * p) / 100) / total) * 100),
    );
    completed += f.size;
    result.push({ name: f.name, type: f.type, data });
  }
  return result;
}

export function download(out: Output) {
  const blob = new Blob([out.data as BlobPart], { type: out.type }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = out.name;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  window.dispatchEvent(new CustomEvent('plivvi:export', { detail: { count: 1 } }));
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function downloadAll(outputs: Output[]) {
  const { zipSync } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  for (const [i, o] of outputs.entries())
    entries[entries[o.name] ? `${i + 1}-${o.name}` : o.name] = o.data;
  download({ name: 'plivvi-documents.zip', data: zipSync(entries), type: 'application/zip' });
}
