import { integrationConfig } from './config';
import { deadline } from '../lib/deadline';
let identity: Promise<string> | undefined;
export function prepareGoogleIdentity() {
  return (identity ??= (async () => {
    const config = await integrationConfig();
    if (!config.google?.clientId)
      throw Error('Google sign-in is not configured on this site. Email sign-in is available.');
    if (!window.google?.accounts?.oauth2) {
      const script = document.createElement('script');
      try {
        await deadline(
          new Promise<void>((resolve, reject) => {
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () =>
              reject(Error('Google could not load. Check your connection or content blockers.'));
            document.head.append(script);
          }),
          20000,
          'Google took too long to load. Check your connection and try again.',
        );
      } catch (error) {
        script.remove();
        throw error;
      }
    }
    if (!window.google?.accounts?.oauth2)
      throw Error(
        'Google sign-in is unavailable in this browser. Open this site in Safari or Chrome.',
      );
    return config.google.clientId;
  })().catch((error) => {
    identity = undefined;
    throw error;
  }));
}
// Prepare the client before enabling either Google button. Its request is a
// one-shot operation, so a late reply cannot be mistaken for a later attempt.
export function createGoogleSignInRequest(clientId: string) {
  let used = false,
    active = false;
  let accept: (token: string) => void, decline: (error: Error) => void;
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'openid email profile',
    include_granted_scopes: false,
    callback: (result: { access_token?: string; error?: string }) => {
      if (!active) return;
      if (result.error || !result.access_token)
        decline(Error('Google sign-in was not completed. You can try again or use email.'));
      else accept(result.access_token);
    },
    error_callback: (error: { type?: string }) => {
      if (!active) return;
      decline(
        Error(
          error.type === 'popup_failed_to_open'
            ? 'Google’s window was blocked. Open Plivvi in Safari or Chrome and allow its sign-in window, or use email.'
            : 'The Google sign-in window was closed. You can try again.',
        ),
      );
    },
  });
  return function requestGoogleSignIn() {
    if (used)
      return Promise.reject(Error('Please wait for Google to prepare a fresh sign-in attempt.'));
    used = true;
    active = true;
    const pending = new Promise<string>((resolve, reject) => {
      accept = resolve;
      decline = reject;
      // No initialization, imports, or awaits between the tap and this call.
      client.requestAccessToken({ prompt: 'select_account' });
    });
    return deadline(
      pending,
      120000,
      'Google sign-in did not finish. Open Plivvi in Safari or Chrome, allow its sign-in window, or use email.',
    ).finally(() => {
      active = false;
    });
  };
}
