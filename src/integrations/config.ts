import brandDetails from '../brand.json';
import { deadline } from '../lib/deadline';
export type IntegrationConfig = {
  firebase?: { apiKey: string; authDomain: string; projectId: string; appId: string };
  google?: { clientId: string; apiKey: string; appId: string };
  microsoft?: { clientId: string; tenant?: string };
};
let promise: Promise<IntegrationConfig>;
declare const __PLIVVI_PUBLIC_CONFIG__: IntegrationConfig;
async function loadConfig(): Promise<IntegrationConfig> {
  const fallback = typeof __PLIVVI_PUBLIC_CONFIG__ === 'undefined' ? {} : __PLIVVI_PUBLIC_CONFIG__;
  const controller = new AbortController();
  try {
    const config = await deadline(
      fetch('/pocket-config.json', { cache: 'no-cache', signal: controller.signal }).then(
        async (response) => (response.ok ? await response.json() : {}),
      ),
      2500,
      'Configuration request timed out.',
    );
    return {
      ...fallback,
      ...config,
      google: { ...fallback.google, ...config.google },
      microsoft: { ...fallback.microsoft, ...config.microsoft },
    };
  } catch {
    return fallback;
  } finally {
    controller.abort();
  }
}
function json(value: string | undefined) {
  try {
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
}
export function integrationConfig(): Promise<IntegrationConfig> {
  return (promise ??= loadConfig().then((config: IntegrationConfig) => ({
    firebase: json(import.meta.env.VITE_FIREBASE_CONFIG) ?? config.firebase,
    google: {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || config.google?.clientId || '',
      apiKey: import.meta.env.VITE_GOOGLE_API_KEY?.trim() || config.google?.apiKey || '',
      appId: import.meta.env.VITE_GOOGLE_APP_ID?.trim() || config.google?.appId || '',
    },
    microsoft: {
      clientId:
        import.meta.env.VITE_MICROSOFT_CLIENT_ID?.trim() || config.microsoft?.clientId || '',
      tenant: import.meta.env.VITE_MICROSOFT_TENANT?.trim() || config.microsoft?.tenant || 'common',
    },
  })));
}
export const maker = {
  name: 'Ramtin Neshatvar',
  email: 'ramtinneshat4@gmail.com',
  github: 'https://github.com/ramt11n',
  linkedin: 'https://linkedin.com/in/ramtin-neshatvar-185534263',
  cv: 'https://ramtin-neshatvar-cv.asa-adv-agency2.chatgpt.site',
};
export const repoUrl = import.meta.env.VITE_REPO_URL || 'https://github.com/ramt11n/plivvi';
export const sourceUrl = '/source.zip';

export const brand = brandDetails;
