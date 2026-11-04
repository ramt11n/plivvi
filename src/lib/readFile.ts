export function readFile(file: File, onProgress?: (percent: number) => void): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && e.total) onProgress?.((e.loaded / e.total) * 100);
    };
    reader.onerror = () => reject(reader.error ?? Error('This file could not be read.'));
    reader.onabort = () => reject(new DOMException('File reading cancelled', 'AbortError'));
    reader.onload = () => {
      onProgress?.(100);
      resolve(reader.result as ArrayBuffer);
    };
    onProgress?.(0);
    reader.readAsArrayBuffer(file);
  });
}
