export type IntegrationConfig = {
  firebase?: { apiKey: string; authDomain: string; projectId: string; appId: string };
  google?: { clientId: string; apiKey: string; appId: string };
  microsoft?: { clientId: string; tenant?: string };
};
let promise: Promise<IntegrationConfig>;
function json(value: string | undefined) {
  try {
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
}
export function integrationConfig(): Promise<IntegrationConfig> {
  return (promise ??= fetch('/pocket-config.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((config: IntegrationConfig) => ({
      firebase: json(import.meta.env.VITE_FIREBASE_CONFIG) ?? config.firebase,
      google: {
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? config.google?.clientId ?? '',
        apiKey: import.meta.env.VITE_GOOGLE_API_KEY ?? config.google?.apiKey ?? '',
        appId: import.meta.env.VITE_GOOGLE_APP_ID ?? config.google?.appId ?? '',
      },
      microsoft: {
        clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID ?? config.microsoft?.clientId ?? '',
        tenant: import.meta.env.VITE_MICROSOFT_TENANT ?? config.microsoft?.tenant ?? 'common',
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
export const repoUrl = import.meta.env.VITE_REPO_URL || 'https://github.com/ramt11n/pocket-pdf';
export const sourceUrl = '/source.zip';
