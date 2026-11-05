import brand from '../brand.json' with { type: 'json' };
import content from './content.json' with { type: 'json' };
import features from './features.json' with { type: 'json' };
import guides from './guides.json' with { type: 'json' };
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
    publisher: { '@id': origin + '/#organization' },
  };
  const creator = {
    '@type': 'Person',
    '@id': origin + '/#creator',
    name: 'Ramtin Neshatvar',
    url: 'https://github.com/ramt11n',
    sameAs: ['https://linkedin.com/in/ramtin-neshatvar-185534263'],
  };
  const organization = {
    '@type': 'Organization',
    '@id': origin + '/#organization',
    name: brand.name,
    url: origin + '/',
    logo: { '@type': 'ImageObject', url: origin + '/icon-512.png', width: 512, height: 512 },
    founder: { '@id': origin + '/#creator' },
    sameAs: [repo],
  };
  const guide = Object.values(guides).find((item) => path === '/guides/' + item.slug + '/');
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
    publisher: { '@id': origin + '/#organization' },
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    softwareVersion: brand.version,
    isBasedOn: { '@type': 'SoftwareSourceCode', codeRepository: repo },
  };
  const webpage = {
    '@type': ['/tools/', '/guides/'].includes(path) ? 'CollectionPage' : 'WebPage',
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
  const graph: unknown[] = [creator, organization, site, webpage];
  if (guide)
    graph.push({
      '@type': 'Article',
      '@id': url + '#article',
      headline: guide.heading,
      description: guide.description,
      mainEntityOfPage: { '@id': webpage['@id'] },
      author: { '@id': creator['@id'] },
      publisher: { '@id': organization['@id'] },
      dateModified: guide.updated,
      inLanguage: 'en',
      image: origin + '/og.png',
      isAccessibleForFree: true,
    });
  if (path === '/guides/')
    graph.push({
      '@type': 'ItemList',
      itemListElement: Object.values(guides).map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.heading,
        url: origin + '/guides/' + item.slug + '/',
      })),
    });
  if (toolId || path === '/' || path === '/notebooks/') graph.push(app);
  if (path !== '/')
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': url + '#breadcrumbs',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: brand.name, item: origin + '/' },
        ...(guide
          ? [
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Practical guides',
                item: origin + '/guides/',
              },
            ]
          : []),
        ...(toolId
          ? [{ '@type': 'ListItem', position: 2, name: 'PDF tools', item: origin + '/tools/' }]
          : []),
        {
          '@type': 'ListItem',
          position: toolId || guide ? 3 : 2,
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
