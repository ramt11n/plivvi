import wasmURL from 'libarchive-wasm/dist/libarchive.wasm?url';
import type { Input } from '../lib/client';
import { isRar } from './sources';

const MiB = 1024 * 1024;
const order = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const isPage = (name: string) =>
  /\.(jpe?g|png|webp)$/i.test(name) &&
  !name.split(/[/\\]/).some((part) => part.startsWith('.') || part === '__MACOSX');

export async function comicPDF(
  input: Input,
  progress: (stage: string, percent: number) => void,
): Promise<Input> {
  if (input.data.byteLength > 96 * MiB)
    throw Error('Open a CBR smaller than 96 MB to stay within browser memory limits.');
  if (!isRar(new Uint8Array(input.data, 0, Math.min(8, input.data.byteLength))))
    throw Error('This CBR is not a RAR archive.');
  const [{ ArchiveReader, libarchiveWasm }, { PDFDocument }, response] = await Promise.all([
    import('libarchive-wasm'),
    import('pdf-lib'),
    fetch(wasmURL),
  ]);
  if (!response.ok) throw Error('The comic decoder could not load. Check your connection.');
  const wasm = await libarchiveWasm({ wasmBinary: await response.arrayBuffer() });
  let archive: InstanceType<typeof ArchiveReader>;
  try {
    archive = new ArchiveReader(wasm, new Int8Array(input.data));
  } catch {
    throw Error('This comic archive could not be opened. Use a complete, unencrypted CBR.');
  }
  try {
    const pdf = await PDFDocument.create();
    const embedded = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>>>();
    let bytes = 0,
      entries = 0;
    for (const entry of archive.entries()) {
      const name = entry.getPathname(),
        size = entry.getSize();
      if (
        ++entries > 3000 ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        size > 32 * MiB ||
        (bytes += size) > 192 * MiB
      )
        throw Error('This comic expands beyond the browser memory limit.');
      if (entry.getFiletype() !== 'File' || !isPage(name)) continue;
      if (entry.isEncrypted()) throw Error('Password-protected CBR files are not supported.');
      if (embedded.size >= 600) throw Error('Open a CBR with at most 600 image pages.');
      if (embedded.has(name)) throw Error('This CBR has duplicate page paths.');
      let extracted: Int8Array | undefined = undefined;
      try {
        extracted = entry.readData();
      } catch {
        throw Error(
          `Could not extract comic page ${name}. Check that the archive is complete and unencrypted.`,
        );
      }
      if (!extracted?.length || extracted.length !== size)
        throw Error(`Comic page ${name} is incomplete.`);
      const extraction = new Uint8Array(
        extracted.buffer,
        extracted.byteOffset,
        extracted.byteLength,
      );
      let image;
      if (/\.png$/i.test(name)) {
        const png = new DataView(extraction.buffer, extraction.byteOffset, extraction.byteLength);
        if (png.byteLength < 24 || png.getUint32(16) * png.getUint32(20) > 20_000_000)
          throw Error('A comic page is too large for the browser to decode.');
        image = await pdf.embedPng(extraction);
        await image.embed();
      } else if (/\.webp$/i.test(name)) {
        if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined')
          throw Error('This browser cannot decode WebP comic pages. Try a CBR with JPG or PNG.');
        const bitmap = await createImageBitmap(
          new Blob([extraction as BlobPart], { type: 'image/webp' }),
        );
        try {
          const scale = Math.min(1, 2800 / Math.max(bitmap.width, bitmap.height));
          const canvas = new OffscreenCanvas(
            Math.round(bitmap.width * scale),
            Math.round(bitmap.height * scale),
          );
          const ctx = canvas.getContext('2d', { alpha: false })!;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          image = await pdf.embedJpg(
            await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })).arrayBuffer(),
          );
        } finally {
          bitmap.close();
        }
      } else {
        image = await pdf.embedJpg(extraction);
      }
      if (image.width * image.height > 30_000_000)
        throw Error('A comic page is too large for the browser to decode.');
      embedded.set(name, image);
      progress(
        `Unpacking comic pages · ${embedded.size} so far…`,
        Math.min(90, (bytes * 90) / (192 * MiB)),
      );
    }
    if (!embedded.size) throw Error('No JPG, PNG, or WebP pages were found in this CBR.');
    const pages = [...embedded].sort(
      ([a], [b]) => order.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0),
    );
    for (const [, image] of pages) {
      const dimensions = image.scale(960 / Math.max(image.width, image.height));
      pdf.addPage([dimensions.width, dimensions.height]).drawImage(image, {
        x: 0,
        y: 0,
        ...dimensions,
      });
    }
    progress('Preparing the comic for reading…', 96);
    return {
      name: input.name.replace(/\.cbr$/i, '') + '.pdf',
      type: 'application/pdf',
      data: (await pdf.save()).slice().buffer,
    };
  } finally {
    archive.free();
  }
}
