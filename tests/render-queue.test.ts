import { expect, it, vi } from 'vitest';
const remote = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/client', () => ({ rpc: remote }));
import { renderPage } from '../src/reader/renderQueue';
it('serializes bitmap work and skips obsolete queued zoom requests', async () => {
  let complete!: (value: { data: Uint8Array }) => void;
  remote.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  remote.mockResolvedValue({ data: new Uint8Array([3]) });
  const a = new AbortController(),
    b = new AbortController(),
    c = new AbortController();
  const first = renderPage('book', 0, 600, a.signal);
  const obsolete = renderPage('book', 0, 900, b.signal).catch((error) => error);
  const last = renderPage('book', 0, 1200, c.signal);
  b.abort();
  expect(remote).toHaveBeenCalledTimes(1);
  complete({ data: new Uint8Array([1]) });
  expect((await first).data[0]).toBe(1);
  expect((await obsolete).name).toBe('AbortError');
  expect((await last).data[0]).toBe(3);
  expect(remote).toHaveBeenCalledTimes(2);
  expect(remote.mock.calls[1][1].width).toBe(1200);
});
