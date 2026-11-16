import type { Output } from '../lib/client';

// A conversion can be cancelled without discarding an open reader's worker session.
export function conversionClient() {
  let worker: Worker | undefined,
    seq = 0;
  const requests = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      progress?: (label: string, percent?: number) => void;
      output?: (output: Output) => Promise<void>;
    }
  >();
  function close(message = 'Conversion cancelled. Your original files are unchanged.') {
    worker?.terminate();
    worker = undefined;
    for (const request of requests.values()) request.reject(Error(message));
    requests.clear();
  }
  return {
    close,
    request<T>(
      op: string,
      payload: any,
      progress?: (label: string, percent?: number) => void,
      output?: (output: Output) => Promise<void>,
    ): Promise<T> {
      if (!worker) {
        worker = new Worker(new URL('../lib/pdf.worker.ts', import.meta.url), { type: 'module' });
        worker.onerror = (event) => {
          event.preventDefault();
          close(
            'The conversion engine was interrupted. Retry to start a fresh engine. ' +
              (event.message || ''),
          );
        };
        worker.onmessageerror = () =>
          close('The browser could not receive a result. Retry the conversion.');
        worker.onmessage = async ({ data }) => {
          const request = requests.get(data.id);
          if (!request) return;
          if (data.output) {
            try {
              await request.output?.(data.output);
              worker?.postMessage({ id: data.id, op: 'convert-ack' });
            } catch (error) {
              close((error as Error).message);
            }
          } else if (data.progress) request.progress?.(data.progress, data.percent);
          else {
            requests.delete(data.id);
            data.error ? request.reject(Error(data.error)) : request.resolve(data.result);
          }
        };
      }
      const id = ++seq;
      return new Promise((resolve, reject) => {
        requests.set(id, { resolve, reject, progress, output });
        try {
          worker!.postMessage({ id, op, payload: { ...payload, ack: !!output } });
        } catch (error) {
          requests.delete(id);
          reject(error);
        }
      });
    },
  };
}
