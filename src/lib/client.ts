export type Input = { name: string; data: ArrayBuffer; type: string };
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
  { resolve: (v: any) => void; reject: (e: Error) => void; progress?: (s: string) => void }
>();
export function rpc<T = any>(
  op: string,
  payload: any,
  onProgress?: (s: string) => void,
): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data: r }) => {
      const p = pending.get(r.id);
      if (!p) return;
      if (r.progress) {
        p.progress?.(r.progress);
        return;
      }
      pending.delete(r.id);
      r.error ? p.reject(new Error(r.error)) : p.resolve(r.result);
    };
    worker.onerror = () => {
      for (const p of pending.values())
        p.reject(new Error('The document engine stopped. Reload and try a smaller file.'));
      pending.clear();
      worker.terminate();
      worker = undefined as any;
    };
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, progress: onProgress });
    worker.postMessage({ id, op, payload });
  });
}
export async function inputs(files: File[]): Promise<Input[]> {
  return Promise.all(
    files.map(async (f) => ({ name: f.name, type: f.type, data: await f.arrayBuffer() })),
  );
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
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function downloadAll(outputs: Output[]) {
  const { zipSync } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  for (const [i, o] of outputs.entries())
    entries[entries[o.name] ? `${i + 1}-${o.name}` : o.name] = o.data;
  download({ name: 'pocket-documents.zip', data: zipSync(entries), type: 'application/zip' });
}
