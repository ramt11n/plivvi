import receiving from './receiving.json';
export type DonationRoute = {
  id: string;
  asset: string;
  network: string;
  standard: string;
  address: string;
  assetId: string;
};
// Receiving routes are owner-provided static configuration. Query strings and
// local browser storage can never replace a payment destination.
export function validateRoutes(value: unknown): DonationRoute[] {
  if (!Array.isArray(value)) throw Error('Donation routes must be a list.');
  const ids = new Set<string>();
  return value.map((route) => {
    for (const key of ['id', 'asset', 'network', 'standard', 'address', 'assetId']) {
      if (typeof route?.[key] !== 'string' || !route[key].trim())
        throw Error('Incomplete donation route.');
    }
    if (ids.has(route.id)) throw Error('Duplicate donation route.');
    ids.add(route.id);
    if (
      !/^[a-z0-9-]+$/.test(route.id) ||
      !/^[A-Z0-9]{2,12}$/.test(route.asset) ||
      !/^[A-Za-z0-9_:.-]{20,180}$/.test(route.address) ||
      !/^c\d+(_t[A-Za-z0-9]+)?$/.test(route.assetId)
    )
      throw Error('Invalid receiving details.');
    if (route.address.startsWith('0x') && !/^0x[0-9a-fA-F]{40}$/.test(route.address))
      throw Error('Invalid EVM receiving address.');
    return {
      id: route.id,
      asset: route.asset,
      network: route.network,
      standard: route.standard,
      address: route.address,
      assetId: route.assetId,
    };
  });
}
export const donationRoutes = validateRoutes(receiving);
export function trustWalletLink(route: DonationRoute) {
  const url = new URL('https://link.trustwallet.com/send');
  url.searchParams.set('asset', route.assetId);
  url.searchParams.set('address', route.address);
  return url.toString();
}
