import type { Input } from './client';

export const inputSize = (input: Input) => input.file?.size ?? input.data.byteLength;
export async function inputData(input: Input): Promise<ArrayBuffer> {
  return input.file ? input.file.arrayBuffer() : input.data;
}

/** MuPDF reads the original browser File on demand, including files larger than WASM memory. */
export function inputStream(mupdf: typeof import('mupdf'), input: Input) {
  const Reader = (globalThis as any).FileReaderSync;
  if (!input.file || !Reader) return undefined;
  const file = input.file;
  const reader = new Reader();
  return new mupdf.Stream({
    fileSize: () => file.size,
    read(memory, offset, length, position) {
      if (position >= file.size) return 0;
      const bytes = new Uint8Array(
        reader.readAsArrayBuffer(
          file.slice(position, position + Math.min(length, 4 * 1024 * 1024)),
        ),
      );
      memory.set(bytes, offset);
      return bytes.length;
    },
    close() {},
  });
}
