import type { ConvertedFile } from './downloads';
export function openHEICEncoder() {
  const id = crypto.randomUUID();
  const channel = new BroadcastChannel(`plivvi-heic-${id}`);
  const popup = window.open(`/codec.html#${id}`, '_blank', 'popup,width=540,height=480');
  if (!popup) {
    channel.close();
    throw Error('Allow the local conversion window to open, then try again.');
  }
  let resolveReady: () => void, rejectReady: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Catch an unused rejected promise if document conversion fails before encoding begins.
  ready.catch(() => {});
  const timer = setTimeout(
    () => rejectReady(Error('The HEIC conversion window did not start. Keep it open and retry.')),
    60000,
  );
  const pending = new Map<
    string,
    {
      resolve: (file: ConvertedFile) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  channel.onmessage = ({ data }) => {
    if (data.ready) {
      clearTimeout(timer);
      resolveReady();
      return;
    }
    if (data.error && !data.id) {
      clearTimeout(timer);
      rejectReady(Error(data.error));
      return;
    }
    const request = pending.get(data.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(data.id);
    if (data.error) request.reject(Error(data.error));
    else
      request.resolve({
        name: data.name,
        type: 'image/heic',
        blob: new Blob([data.bytes], { type: 'image/heic' }),
      });
  };
  return {
    async encode(file: ConvertedFile, quality: number) {
      await ready;
      const bytes = await file.blob.arrayBuffer(),
        requestId = crypto.randomUUID();
      return new Promise<ConvertedFile>((resolve, reject) => {
        pending.set(requestId, {
          resolve,
          reject,
          timer: setTimeout(() => {
            pending.delete(requestId);
            reject(
              Error(
                'HEIC encoding took too long. Keep the conversion window open or choose another format.',
              ),
            );
          }, 180000),
        });
        channel.postMessage({
          id: requestId,
          bytes,
          quality,
          name: file.name.replace(/\.png$/i, '.heic'),
        });
      });
    },
    close() {
      clearTimeout(timer);
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(Error('Conversion closed.'));
      }
      pending.clear();
      channel.postMessage({ close: true });
      channel.close();
      try {
        popup.close();
      } catch {}
    },
  };
}
