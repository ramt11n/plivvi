// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let instances: FakeWorker[], handle: (worker: FakeWorker, job: any) => void;
class FakeWorker {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  constructor() {
    instances.push(this);
  }
  postMessage(job: any) {
    queueMicrotask(() => handle(this, job));
  }
  terminate() {
    this.terminated = true;
  }
  crash() {
    this.onerror?.({ message: 'Worker module failed to load', preventDefault() {} });
  }
  result(id: number, result: any) {
    this.onmessage?.({ data: { id, result } });
  }
}
beforeEach(() => {
  vi.resetModules();
  instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());
it('starts a fresh worker once after a bootstrap crash and completes the same immutable request', async () => {
  handle = (worker, job) =>
    instances.length === 1 ? worker.crash() : worker.result(job.id, { count: 2 });
  const { rpc } = await import('../src/lib/client');
  await expect(rpc('preview', { input: { name: 'a.pdf' } })).resolves.toEqual({ count: 2 });
  expect(instances).toHaveLength(2);
  expect(instances[0].terminated).toBe(true);
});
it('rejects a repeated failure and allows a later explicit retry', async () => {
  handle = (worker) => worker.crash();
  const { rpc } = await import('../src/lib/client');
  await expect(rpc('preview', {})).rejects.toThrow('interrupted');
  expect(instances).toHaveLength(2);
  handle = (worker, job) => worker.result(job.id, 'ready');
  await expect(rpc('preview', {})).resolves.toBe('ready');
  expect(instances).toHaveLength(3);
});
it('does not duplicate already-delivered outputs by retrying a partially completed conversion', async () => {
  handle = (worker, job) => {
    worker.onmessage?.({
      data: {
        id: job.id,
        output: { name: 'page-1.png', type: 'image/png', data: new Uint8Array([1]) },
      },
    });
    worker.crash();
  };
  const { rpc } = await import('../src/lib/client'),
    output = vi.fn();
  await expect(rpc('convert', {}, undefined, output)).rejects.toThrow('interrupted');
  expect(output).toHaveBeenCalledTimes(1);
  expect(instances).toHaveLength(1);
});
it('requires reopening a reader session after a worker crash instead of reusing a stale session id', async () => {
  handle = (worker) => worker.crash();
  const { rpc } = await import('../src/lib/client');
  await expect(rpc('reader-render', { session: 'old', index: 0 })).rejects.toThrow('reopen');
  expect(instances).toHaveLength(1);
});
