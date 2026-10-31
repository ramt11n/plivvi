import { rpc, type Input, type Output } from './client';
export async function recognize(
  files: Input[],
  options: any,
  progress: (s: string) => void,
): Promise<Output[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(options.language ?? 'eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: '/ocr/lang',
    workerBlobURL: false,
    logger: (m) => progress(`${m.status} ${Math.round((m.progress ?? 0) * 100)}%`),
  });
  const images: Input[] = [],
    pages: any[] = [];
  try {
    for (const file of files) {
      let sources: Uint8Array[] = [];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const p = await rpc('preview', { input: file, password: options.currentPassword });
        for (let i = 0; i < p.count; i++) {
          const r = await rpc('render', {
            input: file,
            password: options.currentPassword,
            index: i,
            width: 1700,
          });
          sources.push(r.data);
        }
      } else sources = [new Uint8Array(file.data)];
      for (const data of sources) {
        progress(`Reading page ${pages.length + 1}…`);
        const { data: result } = await worker.recognize(
          new Blob([data as BlobPart]),
          {},
          { blocks: true },
        );
        pages.push(result);
        images.push({
          name: `page-${pages.length}.jpg`,
          data: data.buffer as ArrayBuffer,
          type: 'image/jpeg',
        });
      }
    }
    if (options.ocrOutput === 'searchable')
      return rpc('operate', { tool: 'ocr-build', files: images, options: { ocrPages: pages } });
    return [
      {
        name: 'recognized-text.txt',
        data: new TextEncoder().encode(pages.map((p) => p.text).join('\n\n')),
        type: 'text/plain',
      },
    ];
  } finally {
    await worker.terminate();
  }
}
