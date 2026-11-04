import brand from '../brand.json' with { type: 'json' };
import content from './content.json' with { type: 'json' };
import features from './features.json' with { type: 'json' };
const repo = 'https://github.com/ramt11n/plivvi';
export function structuredData(
  origin: string,
  path: string,
  title: string,
  description: string,
  toolId?: string,
) {
  const identity = (value: string) => value.replaceAll('{brand}', brand.name);
  const url = origin + path;
  const site = {
    '@type': 'WebSite',
    '@id': origin + '/#website',
    url: origin + '/',
    name: brand.name,
    alternateName: 'Plivvi PDF Tools',
    inLanguage: 'en',
    publisher: { '@id': origin + '/#creator' },
  };
  const creator = {
    '@type': 'Person',
    '@id': origin + '/#creator',
    name: 'Ramtin Neshatvar',
    url: 'https://github.com/ramt11n',
    sameAs: ['https://linkedin.com/in/ramtin-neshatvar-185534263'],
  };
  const app = {
    '@type': 'WebApplication',
    '@id': url + '#application',
    name: identity(title).replace(/ · Plivvi$/, ''),
    url,
    description: identity(description),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Modern web browser',
    browserRequirements: 'JavaScript and WebAssembly',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@id': origin + '/#creator' },
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    softwareVersion: brand.version,
    isBasedOn: { '@type': 'SoftwareSourceCode', codeRepository: repo },
  };
  const webpage = {
    '@type': path === '/tools/' ? 'CollectionPage' : 'WebPage',
    '@id': url + '#page',
    url,
    name: identity(title),
    description: identity(description),
    isPartOf: { '@id': origin + '/#website' },
    inLanguage: 'en',
    ...(toolId || path === '/' || path === '/notebooks/'
      ? { mainEntity: { '@id': app['@id'] } }
      : {}),
  };
  const graph: unknown[] = [creator, site, webpage];
  if (toolId || path === '/' || path === '/notebooks/') graph.push(app);
  if (path !== '/')
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': url + '#breadcrumbs',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: brand.name, item: origin + '/' },
        ...(toolId
          ? [{ '@type': 'ListItem', position: 2, name: 'PDF tools', item: origin + '/tools/' }]
          : []),
        {
          '@type': 'ListItem',
          position: toolId ? 3 : 2,
          name: identity(title).split(' — ')[0],
          item: url,
        },
      ],
    });
  if (path === '/tools/')
    graph.push({
      '@type': 'ItemList',
      itemListElement: [...Object.values(content), ...Object.values(features)].map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.title,
        url: origin + '/' + item.slug + '/',
      })),
    });
  return { '@context': 'https://schema.org', '@graph': graph };
}
