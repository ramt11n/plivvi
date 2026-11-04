import { afterEach, beforeEach, expect, it, vi } from 'vitest';
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('rejects a stalled database open, retries a fresh connection, and closes a late connection', async () => {
  const requests: any[] = [];
  vi.stubGlobal('indexedDB', {
    open: vi.fn(() => {
      const r = {};
      requests.push(r);
      return r;
    }),
  });
  const { get } = await import('../src/lib/storage');
  const first = expect(get('saved-docs')).rejects.toThrow('has not been cleared');
  await vi.advanceTimersByTimeAsync(10000);
  await first;
  const second = expect(get('saved-docs')).rejects.toThrow('did not respond');
  expect(requests).toHaveLength(2);
  const close = vi.fn();
  requests[0].result = { close };
  requests[0].onsuccess();
  expect(close).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(10000);
  await second;
});
it('aborts a stalled write rather than reporting success or allowing a late commit', async () => {
  const transaction: any = {
    abort: vi.fn(),
    objectStore: () => ({ put: () => ({ result: 'saved' }) }),
  };
  const db = { transaction: () => transaction, close: vi.fn() };
  let request: any;
  vi.stubGlobal('indexedDB', { open: () => (request = {}) });
  const { set } = await import('../src/lib/storage');
  const rejected = expect(set('saved-docs', ['keep'])).rejects.toThrow('has not been cleared');
  request.result = db;
  request.onsuccess();
  await vi.advanceTimersByTimeAsync(10000);
  await rejected;
  expect(transaction.abort).toHaveBeenCalledOnce();
  expect(db.close).toHaveBeenCalledOnce();
});
it('waits for transaction commit before acknowledging a write in the existing database', async () => {
  let request: any;
  const transaction: any = { objectStore: () => ({ put: () => ({ result: 'saved' }) }) };
  const open = vi.fn(() => (request = {}));
  vi.stubGlobal('indexedDB', { open });
  const { set } = await import('../src/lib/storage');
  let saved = false;
  const pending = set('pocket-documents', ['existing']).then(() => {
    saved = true;
  });
  request.result = { transaction: () => transaction, close() {} };
  request.onsuccess();
  await vi.advanceTimersByTimeAsync(0);
  expect(saved).toBe(false);
  transaction.oncomplete();
  await pending;
  expect(saved).toBe(true);
  expect(open).toHaveBeenCalledWith('keyval-store');
  expect(vi.getTimerCount()).toBe(0);
});
