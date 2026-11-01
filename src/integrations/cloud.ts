import { brand, integrationConfig, type IntegrationConfig } from './config';
import { deadline } from '../lib/deadline';
import type { Output } from '../lib/client';
import type { PublicClientApplication } from '@azure/msal-browser';
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}
type GoogleSession = { token: string; until: number; email?: string; name?: string };
const googleSessions = new Map<string, GoogleSession>();
const microsoftClients = new Map<string, Promise<PublicClientApplication>>();
export type CloudConnections = { google?: { email: string }; microsoft?: { email: string } };
export async function cloudConnections(workspace: string): Promise<CloudConnections> {
  const google = googleSessions.get(workspace);
  const microsoft = microsoftClients.has(workspace)
    ? (await microsoftClients.get(workspace)!).getActiveAccount()
    : null;
  return {
    google: google ? { email: google.email || 'Google account' } : undefined,
    microsoft: microsoft ? { email: microsoft.username } : undefined,
  };
}
export function cloudCopyName(original: string) {
  const safe =
    original
      .replace(/[<>:\x22/\\|?*\x00-\x1f]/g, '-')
      .replace(/[. ]+$/, '')
      .slice(0, 180) || 'document';
  const dot = safe.lastIndexOf('.'),
    stamp = Date.now() + '-' + crypto.randomUUID().slice(0, 8);
  return dot > 0 ? `${safe.slice(0, dot)}-${stamp}${safe.slice(dot)}` : `${safe}-${stamp}`;
}
const scripts = new Map<string, Promise<void>>();
function script(src: string) {
  if (scripts.has(src)) return scripts.get(src)!;
  const s = document.createElement('script');
  const promise = deadline(
    new Promise<void>((resolve, reject) => {
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scripts.delete(src);
        s.remove();
        reject(
          Error(
            'The cloud provider could not load. Check your connection or browser content blockers.',
          ),
        );
      };
      document.head.append(s);
    }),
    20000,
    'The cloud provider took too long to load. Check your connection or browser content blockers.',
  ).catch((error) => {
    scripts.delete(src);
    s.remove();
    throw error;
  });
  scripts.set(src, promise);
  return promise;
}
let googleConfig: IntegrationConfig['google'];
let googlePreparation: Promise<void> | undefined;
export function prepareGoogle() {
  return (googlePreparation ??= (async () => {
    const [config] = await Promise.all([
      integrationConfig(),
      script('https://accounts.google.com/gsi/client'),
      script('https://apis.google.com/js/api.js'),
    ]);
    await deadline(
      new Promise<void>((resolve, reject) =>
        window.gapi.load('picker', {
          callback: resolve,
          onerror: () => reject(Error('Google Picker could not load.')),
        }),
      ),
      20000,
      'Google Picker took too long to load. Check your connection and try again.',
    );
    googleConfig = config.google;
  })().catch((error) => {
    googlePreparation = undefined;
    throw error;
  }));
}
async function googleToken(workspace: string, selectAccount = false) {
  const current = googleSessions.get(workspace);
  if (!selectAccount && current && current.until > Date.now() + 60000) return current.token;
  // The dialog prepares configuration and scripts before enabling Connect.
  // Avoid an async setup step between Safari's tap and the consent popup.
  const config = googleConfig ?? (await integrationConfig()).google;
  if (!config?.clientId) throw Error('Google Drive has not been enabled by the owner yet.');
  let active = true;
  const pending = new Promise<string>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: 'openid email https://www.googleapis.com/auth/drive.file',
      login_hint: !selectAccount ? current?.email : undefined,
      callback: (r: any) => {
        if (!active) return;
        if (r.error) {
          reject(Error('Google Drive permission was not granted.'));
          return;
        }
        googleSessions.set(workspace, {
          token: r.access_token,
          until: Date.now() + Number(r.expires_in) * 1000,
          email: !selectAccount ? current?.email : undefined,
        });
        resolve(r.access_token);
      },
      error_callback: () => reject(Error('The Google sign-in window was closed or blocked.')),
    });
    client.requestAccessToken({ prompt: selectAccount || !current ? 'select_account' : '' });
  });
  return deadline(
    pending,
    120000,
    'Google Drive did not finish connecting. Check the Google consent window, allow pop-ups for this site, or open Plivvi in Safari, Chrome, Firefox, or Brave and try again.',
  ).finally(() => {
    active = false;
  });
}
async function checked(response: Response) {
  if (response.ok) return response;
  let message = 'The cloud request could not be completed.';
  try {
    const r = await response.json();
    message = r.error?.message ?? r.error_description ?? message;
  } catch {}
  throw Error(message);
}
export async function importGoogle(workspace: string): Promise<File[]> {
  const config = await integrationConfig(),
    token = await googleToken(workspace);
  if (!config.google?.apiKey || !config.google.appId)
    throw Error('Google Drive has not been fully configured by the owner yet.');
  return new Promise((resolve, reject) => {
    const picker = new window.google.picker.PickerBuilder()
      .addView(
        new window.google.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false),
      )
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(config.google!.apiKey)
      .setAppId(config.google!.appId)
      .setOrigin(location.origin)
      .setTitle(`Choose documents for ${brand.name}`)
      .setCallback(async (event: any) => {
        if (event.action === window.google.picker.Action.CANCEL) {
          resolve([]);
          return;
        }
        if (event.action !== window.google.picker.Action.PICKED) return;
        try {
          const files: File[] = [];
          for (const doc of event.docs) {
            if (Number(doc.sizeBytes) > 100 * 1048576)
              throw Error('Choose cloud files smaller than 100 MB.');
            const native = String(doc.mimeType ?? '').startsWith('application/vnd.google-apps.'),
              response = await checked(
                await fetch(
                  `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}${native ? '/export?mimeType=application%2Fpdf' : '?alt=media'}`,
                  { headers: { Authorization: `Bearer ${token}` } },
                ),
              );
            const blob = await response.blob();
            if (blob.size > 100 * 1048576) throw Error('Choose cloud files smaller than 100 MB.');
            files.push(
              new File([blob], doc.name + (native ? '.pdf' : ''), {
                type: blob.type || doc.mimeType,
              }),
            );
          }
          resolve(files);
        } catch (e) {
          reject(e);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
export async function exportGoogle(out: Output, progress: (s: string) => void, workspace: string) {
  const token = await googleToken(workspace),
    name = cloudCopyName(out.name),
    start = await checked(
      await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': out.type,
            'X-Upload-Content-Length': String(out.data.length),
          },
          body: JSON.stringify({ name, mimeType: out.type }),
        },
      ),
    ),
    location = start.headers.get('Location');
  if (!location || new URL(location).origin !== 'https://www.googleapis.com')
    throw Error('Google Drive did not provide a valid upload location.');
  const chunk = 5 * 1024 * 1024;
  let result: any;
  for (let offset = 0; offset < out.data.length; offset += chunk) {
    const end = Math.min(out.data.length, offset + chunk);
    progress(`Saving to Drive · ${Math.round((end / out.data.length) * 100)}%`);
    const response = await fetch(location, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': out.type,
        'Content-Range': `bytes ${offset}-${end - 1}/${out.data.length}`,
      },
      body: out.data.slice(offset, end) as BodyInit,
    });
    if (response.status !== 308) {
      await checked(response);
      result = await response.json();
    }
  }
  if (!result) throw Error('The upload has not completed. Please retry with a fresh copy.');
  return { name: result.name ?? name, url: result.webViewLink as string | undefined };
}
export function microsoftClient(workspace: string) {
  if (!microsoftClients.has(workspace)) {
    const pending = (async () => {
      const config = await integrationConfig();
      if (!config.microsoft?.clientId)
        throw Error('OneDrive needs owner configuration on this deployment.');
      const { PublicClientApplication } = await import('@azure/msal-browser');
      const client = new PublicClientApplication({
        auth: {
          clientId: config.microsoft.clientId,
          authority: `https://login.microsoftonline.com/${encodeURIComponent(config.microsoft.tenant ?? 'common')}`,
          redirectUri: location.origin + '/redirect.html',
        },
        cache: { cacheLocation: 'memoryStorage' },
      });
      await deadline(
        client.initialize(),
        20000,
        'OneDrive took too long to load. Check your connection and try again.',
      );
      return client;
    })().catch((error) => {
      microsoftClients.delete(workspace);
      throw error;
    });
    microsoftClients.set(workspace, pending);
  }
  return microsoftClients.get(workspace)!;
}
async function microsoftToken(workspace: string, write = false, selectAccount = false) {
  const client = await microsoftClient(workspace),
    scopes = [write ? 'Files.ReadWrite' : 'Files.Read'];
  const account = client.getActiveAccount();
  if (account && !selectAccount) {
    try {
      return (await client.acquireTokenSilent({ account, scopes })).accessToken;
    } catch {}
  }
  const response = await deadline(
    client.acquireTokenPopup({
      scopes,
      account: selectAccount ? undefined : (account ?? undefined),
      prompt: selectAccount || !account ? 'select_account' : undefined,
    }),
    120000,
    'OneDrive did not finish connecting. Check the Microsoft sign-in window and try again.',
  );
  client.setActiveAccount(response.account);
  return response.accessToken;
}
export async function connectGoogle(workspace: string, selectAccount = true) {
  const token = await googleToken(workspace, selectAccount);
  const response = await checked(
    await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  const profile = await response.json(),
    session = googleSessions.get(workspace);
  if (session) googleSessions.set(workspace, { ...session, email: profile.email });
  return cloudConnections(workspace);
}
export async function connectOneDrive(workspace: string, selectAccount = true) {
  await microsoftToken(workspace, false, selectAccount);
  return cloudConnections(workspace);
}
export type CloudItem = {
  id: string;
  name: string;
  size: number;
  folder?: { childCount: number };
  file?: { mimeType: string };
};
export async function listOneDrive(
  workspace: string,
  folder?: string,
  next?: string,
): Promise<{ items: CloudItem[]; next?: string }> {
  const token = await microsoftToken(workspace),
    url =
      next ??
      (folder
        ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(folder)}/children?$top=200&$select=id,name,size,folder,file`
        : 'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=200&$select=id,name,size,folder,file'),
    response = await checked(
      await fetch(validGraphUrl(url), { headers: { Authorization: `Bearer ${token}` } }),
    ),
    json = await response.json();
  return { items: json.value ?? [], next: json['@odata.nextLink'] };
}
export async function importOneDrive(item: CloudItem, workspace: string) {
  if (item.size > 100 * 1048576) throw Error('Choose files smaller than 100 MB.');
  const token = await microsoftToken(workspace),
    response = await checked(
      await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(item.id)}/content`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    ),
    blob = await response.blob();
  if (blob.size > 100 * 1048576) throw Error('Choose files smaller than 100 MB.');
  return new File([blob], item.name, { type: item.file?.mimeType ?? blob.type });
}
export async function exportOneDrive(out: Output, workspace: string) {
  if (out.data.length > 250 * 1048576)
    throw Error('This copy is too large for a simple OneDrive upload.');
  const token = await microsoftToken(workspace, true),
    name = cloudCopyName(out.name),
    response = await checked(
      await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(name)}:/content`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': out.type },
          body: out.data as BodyInit,
        },
      ),
    );
  const result = await response.json();
  return { name: result.name ?? name, url: result.webUrl as string | undefined };
}
export function validGraphUrl(value: string) {
  const url = new URL(value);
  if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/me/drive/'))
    throw Error('OneDrive returned an invalid page address.');
  return url.href;
}
export async function disconnectCloud(workspace: string, provider?: 'google' | 'microsoft') {
  if (!provider || provider === 'google') googleSessions.delete(workspace);
  if ((!provider || provider === 'microsoft') && microsoftClients.has(workspace)) {
    const client = await microsoftClients.get(workspace)!;
    await client.clearCache();
    microsoftClients.delete(workspace);
  }
}
