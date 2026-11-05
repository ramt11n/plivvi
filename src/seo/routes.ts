import brand from '../brand.json';
import content from './content.json';
import featureData from './features.json';
import { structuredData } from './schema';
import sitePages from './site-pages.json';
import guides from './guides.json';
import { tools } from '../lib/catalog';
export type ToolContent = {
  slug: string;
  title: string;
  description: string;
  heading: string;
  steps: string[];
  faqs: { q: string; a: string }[];
};
export const toolContent = content as Record<string, ToolContent>;
export type FeatureContent = ToolContent & { toolId: string; options: Record<string, string> };
export const featureContent = featureData as Record<string, FeatureContent>;
export const guideContent = guides;
export function guidePath(id: keyof typeof guides) {
  return '/guides/' + guides[id].slug + '/';
}
export type Route = {
  view: string;
  toolId?: string;
  featureId?: string;
  guideId?: keyof typeof guides;
};
export function toolPath(id: string) {
  return '/' + (toolContent[id]?.slug ?? id) + '/';
}
export function currentRoute(): Route {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { view: 'home' };
  const views: Record<string, string> = {
    '/tools': 'tools',
    '/guides': 'guides',
    '/documents': 'documents',
    '/notebooks': 'notebooks',
    '/templates': 'templates',
    '/about': 'about',
    '/privacy': 'privacy',
    '/contact': 'contact',
    '/support': 'support',
    '/account': 'account',
  };
  if (views[path]) return { view: views[path] };
  const guide = Object.entries(guides).find(([, g]) => '/guides/' + g.slug === path);
  if (guide) return { view: 'guide', guideId: guide[0] as keyof typeof guides };
  const feature = Object.entries(featureContent).find(([, f]) => '/' + f.slug === path);
  if (feature) return { view: 'tool', toolId: feature[1].toolId, featureId: feature[0] };
  const entry = Object.entries(toolContent).find(([, c]) => '/' + c.slug === path);
  return entry ? { view: 'tool', toolId: entry[0] } : { view: '404' };
}
export function pathForView(view: string) {
  return view === 'home' ? '/' : '/' + view + '/';
}
export function navigateTo(path: string) {
  if (location.pathname !== path) history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}
export function updateSEO(route: Route) {
  const main = sitePages[route.view as keyof typeof sitePages];
  const data = route.guideId
      ? guides[route.guideId]
      : route.featureId
        ? featureContent[route.featureId]
        : route.toolId
          ? toolContent[route.toolId]
          : undefined,
    [title, description] = data
      ? [route.guideId ? data.title : data.title + ' · {brand}', data.description]
      : main
        ? [main.title, main.description]
        : ['Your workspace · {brand}', 'Your local document workspace.'];
  const identity = (value: string) => value.replaceAll('{brand}', brand.name);
  document.title = identity(title);
  const meta = (name: string, value: string, property = false) => {
    const key = property ? 'property' : 'name';
    let node = document.head.querySelector<HTMLMetaElement>(`meta[${key}="${name}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(key, name);
      document.head.append(node);
    }
    node.content = value;
  };
  meta('description', identity(description));
  meta(
    'robots',
    ['documents', 'account', '404'].includes(route.view) ? 'noindex,nofollow' : 'index,follow',
  );
  meta('og:title', identity(title), true);
  meta('og:site_name', brand.name, true);
  meta('og:description', identity(description), true);
  const url =
    (import.meta.env.VITE_SITE_URL || location.origin).replace(/\/$/, '') +
    (route.guideId
      ? guidePath(route.guideId)
      : data
        ? '/' + data.slug + '/'
        : pathForView(route.view));
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel=canonical]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = url;
  meta('og:url', url, true);
  meta(
    'og:image',
    (import.meta.env.VITE_SITE_URL || location.origin).replace(/\/$/, '') + '/og.png',
    true,
  );
  meta('og:image:alt', 'Plivvi — free PDF tools and digital notebooks', true);
  meta('twitter:image:alt', 'Plivvi — free PDF tools and digital notebooks');
  meta('og:image:width', '1200', true);
  meta('og:image:height', '630', true);
  meta('twitter:title', identity(title));
  meta('twitter:description', identity(description));
  meta(
    'twitter:image',
    (import.meta.env.VITE_SITE_URL || location.origin).replace(/\/$/, '') + '/og.png',
  );
  let ld = document.head.querySelector<HTMLScriptElement>('#plivvi-seo-data');
  if (!ld) {
    ld = document.createElement('script');
    ld.id = 'plivvi-seo-data';
    ld.type = 'application/ld+json';
    document.head.append(ld);
  }
  ld.textContent = JSON.stringify(
    structuredData(
      (import.meta.env.VITE_SITE_URL || location.origin).replace(/\/$/, ''),
      route.guideId
        ? guidePath(route.guideId)
        : data
          ? '/' + data.slug + '/'
          : pathForView(route.view),
      title,
      description,
      route.toolId,
    ),
  );
}
export function relatedTools(id: string) {
  const tool = tools.find((t) => t.id === id);
  return tools.filter((t) => t.id !== id && t.group === tool?.group).slice(0, 4);
}
