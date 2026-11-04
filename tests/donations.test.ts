import { expect, it } from 'vitest';
import { donationRoutes, trustWalletLink, validateRoutes } from '../src/donations/model';
it('publishes the owner-provided asset/network pairs without inferring additional chains', () => {
  expect(donationRoutes).toHaveLength(14);
  expect(
    donationRoutes.filter((route) => route.asset === 'USDT').map((route) => route.network),
  ).toEqual(['Ethereum', 'TRON', 'BNB Smart Chain', 'Polygon', 'Avalanche']);
  expect(donationRoutes.some((route) => route.asset === 'USDC')).toBe(false);
});
it('keeps recipient and token identity together in every Trust Wallet QR link', () => {
  for (const route of donationRoutes) {
    const link = new URL(trustWalletLink(route));
    expect(link.origin).toBe('https://link.trustwallet.com');
    expect(link.pathname).toBe('/send');
    expect(link.searchParams.get('address')).toBe(route.address);
    expect(link.searchParams.get('asset')).toBe(route.assetId);
  }
  expect(donationRoutes.find((route) => route.id === 'btc')!.address).toBe(
    'bc1q6sxt392cwhl0txw9hhddeq63tzpya7e8kkpxfc',
  );
  expect(donationRoutes.find((route) => route.id === 'usdt-tron')!.address).toBe(
    'TJKzMLL251B3rn7fSfMEabjCQEASTHs2Yf',
  );
});
it('rejects duplicate routes and malformed or incomplete receiving details', () => {
  const route = donationRoutes[0];
  expect(() => validateRoutes([route, route])).toThrow('Duplicate');
  expect(() => validateRoutes([{ ...route, address: '0x123' }])).toThrow();
  expect(() => validateRoutes([{ ...route, assetId: 'javascript:bad' }])).toThrow();
});
