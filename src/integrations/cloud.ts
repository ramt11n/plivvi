import { integrationConfig } from './config';
import type { Output } from '../lib/client';
import type { PublicClientApplication } from '@azure/msal-browser';
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}
let googleAccess: { token: string; until: number } | undefined,
  msalPromise: Promise<PublicClientApplication>;
const scripts = new Map<string, Promise<void>>();
function script(src: string) {
  if (scripts.has(src)) return scripts.get(src)!;
  const promise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
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
  });
  scripts.set(src, promise);
  return promise;
}
export async function prepareGoogle() {
  await Promise.all([
    script('https://accounts.google.com/gsi/client'),
    script('https://apis.google.com/js/api.js'),
  ]);
  await new Promise<void>((resolve, reject) =>
    window.gapi.load('picker', {
      callback: resolve,
      onerror: () => reject(Error('Google Picker could not load.')),
    }),
  );
}
async function googleToken() {
  if (googleAccess && googleAccess.until > Date.now() + 60000) return googleAccess.token;
  const config = await integrationConfig();
  if (!config.google?.clientId) throw Error('Google Drive has not been enabled by the owner yet.');
  return new Promise<string>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: config.google!.clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (r: any) => {
        if (r.error) {
          reject(Error('Google Drive permission was not granted.'));
          return;
        }
        googleAccess = { token: r.access_token, until: Date.now() + Number(r.expires_in) * 1000 };
        resolve(r.access_token);
      },
      error_callback: () => reject(Error('The Google sign-in window was closed or blocked.')),
    });
    client.requestAccessToken({ prompt: '' });
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
export async function importGoogle(): Promise<File[]> {
  const config = await integrationConfig(),
    token = await googleToken();
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
      .setTitle('Choose documents for Pocket')
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
export async function exportGoogle(out: Output, progress: (s: string) => void) {
  const token = await googleToken(),
    name = out.name.replace(/(\.[^.]+)$/, '-' + Date.now() + '$1'),
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
  return result.name ?? name;
}
export function microsoftClient() {
  return (msalPromise ??= (async () => {
    const config = await integrationConfig();
    if (!config.microsoft?.clientId) throw Error('OneDrive has not been enabled by the owner yet.');
    const { PublicClientApplication } = await import('@azure/msal-browser'),
      client = new PublicClientApplication({
        auth: {
          clientId: config.microsoft.clientId,
          authority: `https://login.microsoftonline.com/${encodeURIComponent(config.microsoft.tenant ?? 'common')}`,
          redirectUri: location.origin + '/redirect.html',
        },
        cache: { cacheLocation: 'memoryStorage' },
      });
    await client.initialize();
    return client;
  })());
}
async function microsoftToken(write = false) {
  const client = await microsoftClient(),
    scopes = [write ? 'Files.ReadWrite' : 'Files.Read'],
    account = client.getActiveAccount() ?? client.getAllAccounts()[0];
  if (account)
    try {
      return (await client.acquireTokenSilent({ account, scopes })).accessToken;
    } catch {}
  const response = await client.acquireTokenPopup({
    scopes,
    prompt: account ? undefined : 'select_account',
  });
  client.setActiveAccount(response.account);
  return response.accessToken;
}
export type CloudItem = {
  id: string;
  name: string;
  size: number;
  folder?: { childCount: number };
  file?: { mimeType: string };
};
export async function listOneDrive(
  folder?: string,
): Promise<{ items: CloudItem[]; more: boolean }> {
  const token = await microsoftToken(),
    url = folder
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(folder)}/children?$top=200&$select=id,name,size,folder,file`
      : 'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=200&$select=id,name,size,folder,file',
    response = await checked(await fetch(url, { headers: { Authorization: `Bearer ${token}` } })),
    json = await response.json();
  return { items: json.value ?? [], more: !!json['@odata.nextLink'] };
}
export async function importOneDrive(item: CloudItem) {
  if (item.size > 100 * 1048576) throw Error('Choose files smaller than 100 MB.');
  const token = await microsoftToken(),
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
export async function exportOneDrive(out: Output) {
  if (out.data.length > 250 * 1048576)
    throw Error('This copy is too large for a simple OneDrive upload.');
  const token = await microsoftToken(true),
    name = out.name.replace(/(\.[^.]+)$/, '-' + Date.now() + '$1'),
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
  return (await response.json()).name ?? name;
}
export async function disconnectCloud() {
  googleAccess = undefined;
  if (msalPromise) {
    const client = await msalPromise;
    await client.clearCache();
  }
}
