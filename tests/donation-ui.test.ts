// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
const qr = vi.hoisted(() => ({
  pending: [] as { link: string; resolve: (value: string) => void }[],
}));
vi.mock('qrcode', () => ({
  toDataURL: (link: string) => new Promise<string>((resolve) => qr.pending.push({ link, resolve })),
}));
import DonatePanel from '../src/donations/DonatePanel';
it('requires a network choice and never displays a previous network QR after switching', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const click = async (text: string) =>
    act(async () =>
      [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!.click(),
    );
  try {
    await act(async () => root.render(createElement(DonatePanel)));
    expect(host.querySelector('a[href*="trustwallet"]')).toBeNull();
    await click('USDT · Ethereum');
    const ethereum = qr.pending.at(-1)!;
    await click('USDT · TRON');
    const tron = qr.pending.at(-1)!;
    await act(async () => ethereum.resolve('data:image/png;base64,old'));
    expect(host.querySelector<HTMLImageElement>('.donate-qr-row img')).toBeNull();
    await act(async () => tron.resolve('data:image/png;base64,current'));
    expect(host.querySelector<HTMLImageElement>('.donate-qr-row img')!.alt).toContain('TRON');
    expect(host.querySelector('a[href*="trustwallet"]')!.getAttribute('href')).toBe(tron.link);
    expect(new URL(tron.link).searchParams.get('address')).toBe(
      'TJKzMLL251B3rn7fSfMEabjCQEASTHs2Yf',
    );
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('.donate-search input')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        'Bitcoin',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.querySelector<HTMLImageElement>('.donate-qr-row img')).toBeNull();
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('.donate-search input')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('All crypto');
    expect(host.querySelector<HTMLImageElement>('.donate-qr-row img')).toBeNull();
    expect(host.querySelectorAll('.donate-networks button')).toHaveLength(14);
    await click('BTC · Bitcoin');
    expect(host.querySelector<HTMLInputElement>('.donate-address-label input')!.value).toBe(
      'bc1q6sxt392cwhl0txw9hhddeq63tzpya7e8kkpxfc',
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
