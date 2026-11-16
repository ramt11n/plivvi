import { Zip, ZipPassThrough } from 'fflate';
export type ConvertedFile = { name: string; type: string; blob: Blob };
export async function openZipSink(filename = 'plivvi-converted.zip') {
  const picker = (window as any).showSaveFilePicker;
  let temporary:
    { folder: FileSystemDirectoryHandle; name: string; handle: FileSystemFileHandle } | undefined;
  let sink: FileSystemWritableFileStream;
  if (picker)
    sink = await (
      await picker({
        suggestedName: filename,
        types: [
          {
            description: 'Page archive',
            accept: { 'application/zip': [filename.endsWith('.cbz') ? '.cbz' : '.zip'] },
          },
        ],
      })
    ).createWritable();
  else if (navigator.storage?.getDirectory) {
    const folder = await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle('plivvi-exports', { create: true });
    const name = crypto.randomUUID() + '.zip',
      handle = await folder.getFileHandle(name, { create: true });
    temporary = { folder, name, handle };
    sink = await handle.createWritable();
  } else
    throw Error(
      'This browser cannot stream exports to disk. Download separate results or use desktop Brave, Chrome or Edge.',
    );
  let writes = Promise.resolve(),
    resolveDone!: () => void,
    rejectDone!: (error: unknown) => void;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  done.catch(() => {});
  const zip = new Zip((error, data, final) => {
    if (error) {
      rejectDone(error);
      return;
    }
    writes = writes.then(() => sink.write(data));
    writes.catch(rejectDone);
    if (final) writes.then(() => sink.close()).then(resolveDone, rejectDone);
  });
  const names = new Set<string>();
  return {
    async add(file: ConvertedFile) {
      let name = file.name,
        index = 2;
      while (names.has(name)) name = `${index++}-${file.name}`;
      names.add(name);
      const entry = new ZipPassThrough(name);
      zip.add(entry);
      const reader = file.blob.stream().getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          entry.push(value);
          await writes;
        }
      } finally {
        reader.releaseLock();
      }
      entry.push(new Uint8Array(), true);
      await writes;
    },
    async finish() {
      zip.end();
      await done;
      if (temporary) {
        downloadBlob({
          name: filename,
          type: filename.endsWith('.cbz') ? 'application/vnd.comicbook+zip' : 'application/zip',
          blob: await temporary.handle.getFile(),
        });
        const temp = temporary;
        setTimeout(() => temp.folder.removeEntry(temp.name).catch(() => {}), 120000);
      }
    },
    async abort() {
      zip.terminate();
      await writes.catch(() => {});
      await sink.abort().catch(() => {});
      await temporary?.folder.removeEntry(temporary.name).catch(() => {});
    },
  };
}
export function downloadBlob(file: ConvertedFile) {
  const url = URL.createObjectURL(file.blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  window.dispatchEvent(new CustomEvent('plivvi:export', { detail: { count: 1 } }));
}
export async function downloadZip(
  files: ConvertedFile[],
  direct: boolean,
  progress: (label: string) => void,
) {
  const picker = (window as any).showSaveFilePicker;
  const total = files.reduce((size, file) => size + file.blob.size, 0);
  if (!direct && total > 256 * 1024 * 1024)
    throw Error('Use “Save ZIP to disk” for outputs over 256 MB, or download individual files.');
  const sink =
    direct && picker
      ? await (
          await picker({
            suggestedName: 'plivvi-converted.zip',
            types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
          })
        ).createWritable()
      : undefined;
  const chunks: Uint8Array[] = [];
  let writes = Promise.resolve();
  let finish: () => void, fail: (reason: unknown) => void;
  const done = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const zip = new Zip((error, data, final) => {
    if (error) {
      fail(error);
      return;
    }
    if (sink) writes = writes.then(() => sink.write(data));
    else chunks.push(data);
    if (final) writes.then(finish, fail);
  });
  const names = new Set<string>();
  try {
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      progress(`Packing file ${index + 1} of ${files.length}…`);
      let name = file.name;
      if (names.has(name)) name = `${index + 1}-${name}`;
      names.add(name);
      const entry = new ZipPassThrough(name);
      zip.add(entry);
      const reader = file.blob.stream().getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          entry.push(value);
          await writes;
        }
      } finally {
        reader.releaseLock();
      }
      entry.push(new Uint8Array(), true);
    }
    zip.end();
    await done;
    if (sink) {
      await sink.close();
      window.dispatchEvent(new CustomEvent('plivvi:export', { detail: { count: files.length } }));
    } else
      downloadBlob({
        name: 'plivvi-converted.zip',
        type: 'application/zip',
        blob: new Blob(chunks as BlobPart[], { type: 'application/zip' }),
      });
  } catch (error) {
    zip.terminate();
    await sink?.abort();
    throw error;
  }
}
