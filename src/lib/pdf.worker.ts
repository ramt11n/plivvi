import engineInfo from './engine-info.json';
import wasmURL from '../../node_modules/mupdf/dist/mupdf-wasm.wasm?url';
import { preview, operate, template, sample, render, open, mu } from './engine';
import { enhance, perspective } from './image';
import {
  readerOpen,
  readerClose,
  readerRender,
  readerText,
  readerSearch,
  readerAppendPage,
  readerReorder,
  layoutReaderText,
  exportAnnotations,
} from '../reader/engine';
(globalThis as any).$libmupdf_wasm_Module = {
  locateFile: (path: string) => (path.endsWith('.wasm') ? wasmURL : path),
};
let engineReady: Promise<void> | undefined;
const listeners = new Set<(loaded: number) => void>();
async function prepareEngine(id: number) {
  const listener = (fraction: number) =>
    self.postMessage({
      id,
      progress: 'Downloading the document engine to this device…',
      percent: Math.min(40, fraction * 40),
    });
  listeners.add(listener);
  if (!engineReady)
    engineReady = (async () => {
      const response = await fetch(wasmURL);
      if (!response.ok)
        throw Error('The document engine could not download. Check your connection and try again.');
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          for (const notify of listeners) notify(loaded / engineInfo.wasmBytes);
        }
      } else {
        const value = new Uint8Array(await response.arrayBuffer());
        chunks.push(value);
        loaded = value.byteLength;
      }
      const binary = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        binary.set(chunk, offset);
        offset += chunk.byteLength;
      }
      (globalThis as any).$libmupdf_wasm_Module.wasmBinary = binary;
      await mu();
    })().catch((error) => {
      engineReady = undefined;
      throw error;
    });
  try {
    await engineReady;
  } finally {
    listeners.delete(listener);
  }
}
async function handle({ data: { id, op, payload } }: MessageEvent) {
  try {
    let result: any;
    if (op !== 'enhance' && op !== 'reader-comic') await prepareEngine(id);
    const progress = (label: string, percent?: number) =>
      self.postMessage({ id, progress: label, percent });
    progress('Preparing your document…', 45);
    if (op === 'reader-comic')
      result = await (await import('../reader/comic')).comicPDF(payload.input, progress);
    else if (op === 'reader-open')
      result = await readerOpen(payload.input, payload.password, (done, total) =>
        progress(`Preparing page ${done} of ${total}…`, 45 + (50 * done) / total),
      );
    else if (op === 'reader-close') result = readerClose(payload.session);
    else if (op === 'reader-render')
      result = await readerRender(payload.session, payload.index, payload.width);
    else if (op === 'reader-text') result = readerText(payload.session, payload.index);
    else if (op === 'reader-search') result = readerSearch(payload.session, payload.query);
    else if (op === 'reader-export')
      result = await exportAnnotations(
        payload.input,
        payload.password,
        payload.marks,
        payload.flatten,
      );
    else if (op === 'reader-add-page')
      result = await readerAppendPage(
        payload.input,
        payload.password,
        payload.paper,
        payload.paperSettings,
      );
    else if (op === 'reader-reorder')
      result = await readerReorder(payload.input, payload.password, payload.order);
    else if (op === 'reader-layout-text')
      result = await layoutReaderText(payload.text, payload.size, payload.width);
    else if (op === 'preview')
      result = await preview(payload.input, payload.password, payload.pageIndex);
    else if (op === 'operate')
      result = await operate(payload.tool, payload.files, payload.options, (s) =>
        progress(
          s,
          (() => {
            const m = s.match(/(\d+) of (\d+)/);
            return m ? 45 + (50 * Number(m[1])) / Number(m[2]) : undefined;
          })(),
        ),
      );
    else if (op === 'template') {
      progress('Creating your template…', 60);
      result = await template(payload.template, payload.options);
      progress('Finishing your template…', 95);
    } else if (op === 'sample') result = await sample();
    else if (op === 'render') {
      const doc = await open(payload.input, payload.password);
      try {
        result = await render(doc, payload.index, payload.width ?? 1400, payload.jpeg !== false);
      } finally {
        doc.destroy();
      }
    } else if (op === 'enhance') {
      const source = new ImageData(
          new Uint8ClampedArray(payload.data),
          payload.width,
          payload.height,
        ),
        cropped = payload.points ? perspective(source, payload.points) : source;
      const out = enhance(
        cropped,
        payload.filter,
        payload.strength,
        payload.brightness,
        payload.contrast,
      );
      result = { data: out.data, width: out.width, height: out.height };
    } else throw Error('Unknown document operation.');
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
  }
}
let jobs = Promise.resolve();
self.onmessage = (event: MessageEvent) => {
  jobs = jobs.then(() => handle(event));
};
