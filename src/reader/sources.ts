export const readerFileLimit = 256 * 1024 * 1024;
export const isComicFile = (file: Pick<File, 'name' | 'type'>) =>
  /\.(cbr|rar)$/i.test(file.name) ||
  [
    'application/vnd.comicbook-rar',
    'application/x-cbr',
    'application/x-rar-compressed',
    'application/vnd.rar',
  ].includes(file.type);
export const isRar = (head: Uint8Array) =>
  [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07].every((byte, i) => head[i] === byte) &&
  (head[6] === 0 || (head[6] === 1 && head[7] === 0));
export function readerFormat(head: Uint8Array): 'pdf' | 'cbr' {
  if (isRar(head)) return 'cbr';
  if (new TextDecoder().decode(head.subarray(0, 1024)).includes('%PDF-')) return 'pdf';
  throw Error('Choose a PDF or a CBR comic containing a RAR archive.');
}

export async function fetchReaderFile(
  value: string,
  signal: AbortSignal,
  onProgress: (percent?: number) => void,
) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw Error('Paste a complete HTTPS link to a PDF or CBR file.');
  }
  if (url.protocol !== 'https:' || url.username || url.password)
    throw Error('Use a direct HTTPS link without a username or password.');
  let response: Response;
  try {
    response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (error) {
    if (signal.aborted) throw error;
    throw Error(
      'This site did not let Plivvi fetch the file. Use a public direct download link that allows cross-origin requests, or download it and open it here.',
    );
  }
  if (!response.ok)
    throw Error(`The file server returned HTTP ${response.status}. Check that the link is public.`);
  const type = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (type.startsWith('text/') || type === 'application/json')
    throw Error('That link points to a web page. Paste the direct file download link.');
  const length = Number(response.headers.get('content-length'));
  if (length > readerFileLimit) {
    await response.body?.cancel();
    throw Error('Open files smaller than 256 MB.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error('The file server did not provide a download.');
  const chunks: BlobPart[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      total += chunk.byteLength;
      if (total > readerFileLimit) {
        await reader.cancel();
        throw Error('Open files smaller than 256 MB.');
      }
      chunks.push(chunk as BlobPart);
      onProgress(length > 0 ? Math.min(99, (total * 100) / length) : undefined);
    }
  } finally {
    reader.releaseLock();
  }
  const blob = new Blob(chunks);
  const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  const rar = readerFormat(head) === 'cbr';
  const path = new URL(response.url || url.href).pathname.split('/').pop() || 'Online document';
  let name = path;
  try {
    name = decodeURIComponent(path);
  } catch {}
  const extension = rar ? '.cbr' : '.pdf';
  return new File([blob], name.replace(/\.(pdf|cbr)$/i, '') + extension, {
    type: rar ? 'application/vnd.comicbook-rar' : 'application/pdf',
  });
}
