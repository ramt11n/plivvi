import { rpc } from '../lib/client';
type Job = {
  session: string;
  index: number;
  width: number;
  signal: AbortSignal;
  resolve: (v: { data: Uint8Array }) => void;
  reject: (e: Error) => void;
};
const queue: Job[] = [];
let running = false;
function pump() {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  if (job.signal.aborted) {
    job.reject(new DOMException('Render superseded', 'AbortError'));
    pump();
    return;
  }
  running = true;
  rpc<{ data: Uint8Array }>('reader-render', {
    session: job.session,
    index: job.index,
    width: job.width,
  })
    .then(
      (value) =>
        job.signal.aborted
          ? job.reject(new DOMException('Render superseded', 'AbortError'))
          : job.resolve(value),
      job.reject,
    )
    .finally(() => {
      running = false;
      pump();
    });
}
export function renderPage(session: string, index: number, width: number, signal: AbortSignal) {
  return new Promise<{ data: Uint8Array }>((resolve, reject) => {
    queue.push({ session, index, width, signal, resolve, reject });
    pump();
  });
}
