import { integrationConfig } from './config';
import type { Auth, User } from 'firebase/auth';
export type Account = { name: string; email: string; verified: boolean };
let authPromise: Promise<Auth>;
export const account = (user: User): Account => ({
  name: user.displayName || user.email?.split('@')[0] || 'Your account',
  email: user.email ?? '',
  verified: user.emailVerified,
});
export async function authClient() {
  return (authPromise ??= (async () => {
    const config = await integrationConfig();
    if (
      !config.firebase?.apiKey ||
      !config.firebase.authDomain ||
      !config.firebase.projectId ||
      !config.firebase.appId
    )
      throw Error(
        'Accounts are not configured on this deployment yet. Every document tool still works as a guest.',
      );
    const { initializeApp, getApps } = await import('firebase/app'),
      { getAuth, setPersistence, browserSessionPersistence } = await import('firebase/auth');
    const app =
        getApps().find((a) => a.name === 'pocket') ?? initializeApp(config.firebase, 'pocket'),
      auth = getAuth(app);
    await setPersistence(auth, browserSessionPersistence);
    await auth.authStateReady();
    return auth;
  })());
}
export function authMessage(error: unknown) {
  const code = (error as any)?.code;
  return (
    (
      {
        'auth/invalid-credential':
          'The email or password was not accepted. Check both and try again.',
        'auth/email-already-in-use':
          'An account already uses this email. Try signing in or resetting its password.',
        'auth/weak-password': 'Choose a longer password.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/popup-closed-by-user': 'The sign-in window was closed. You can try again.',
        'auth/popup-blocked':
          'Your browser blocked the sign-in window. Allow it for this site and try again.',
        'auth/unauthorized-domain':
          'This website address has not been enabled for sign-in by the owner yet. Continue as a guest.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled on this deployment yet.',
        'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
        'auth/network-request-failed':
          'Sign-in needs an internet connection. Your local document tools still work.',
      } as Record<string, string>
    )[code] ?? (error instanceof Error ? error.message : 'Sign-in could not be completed.')
  );
}
