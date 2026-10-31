import wasmURL from '../../node_modules/mupdf/dist/mupdf-wasm.wasm?url';
import { preview, operate, template, sample, render, open } from './engine';
import { enhance, perspective } from './image';
import {
  readerOpen,
  readerClose,
  readerRender,
  readerText,
  readerSearch,
  readerAppendPage,
  layoutReaderText,
  exportAnnotations,
} from '../reader/engine';
(globalThis as any).$libmupdf_wasm_Module = {
  locateFile: (path: string) => (path.endsWith('.wasm') ? wasmURL : path),
};
self.onmessage = async ({ data: { id, op, payload } }) => {
  try {
    let result: any;
    if (op === 'reader-open') result = await readerOpen(payload.input, payload.password);
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
      result = await readerAppendPage(payload.input, payload.password);
    else if (op === 'reader-layout-text')
      result = await layoutReaderText(payload.text, payload.size, payload.width);
    else if (op === 'preview')
      result = await preview(payload.input, payload.password, payload.pageIndex);
    else if (op === 'operate')
      result = await operate(payload.tool, payload.files, payload.options, (s) =>
        self.postMessage({ id, progress: s }),
      );
    else if (op === 'template') result = await template(payload.template, payload.options);
    else if (op === 'sample') result = await sample();
    else if (op === 'render') {
      const doc = await open(payload.input, payload.password);
      try {
        result = await render(doc, payload.index, payload.width ?? 1400, true);
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
};
