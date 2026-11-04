import LoadingProgress from './LoadingProgress';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FolderOpen,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import {
  accountState,
  subscribeAccounts,
  newAccountSession,
  prepareGoogleSession,
  activateAccount,
  switchAccount,
  signOutAccount,
  authClient,
  authMessage,
  authDeadline,
} from '../integrations/auth';
import { disconnectCloud } from '../integrations/cloud';
import { brand } from '../integrations/config';
import { workspaceId } from '../lib/workspace';
import Brand from './Brand';

export default function AccountDialog({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState(accountState),
    [mode, setMode] = useState<'manage' | 'signin' | 'signup' | 'reset'>(() =>
      accountState().accounts.length ? 'manage' : 'signin',
    ),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const pending = useRef<Awaited<ReturnType<typeof newAccountSession>> | undefined>(undefined);
  const googleSession = useRef<
    | {
        slot: Awaited<ReturnType<typeof prepareGoogleSession>>;
        sdk: typeof import('firebase/auth');
      }
    | undefined
  >(undefined);
  const [googleReady, setGoogleReady] = useState(false),
    [googleAttempt, setGoogleAttempt] = useState(0),
    [googleProgress, setGoogleProgress] = useState('');
  const mounted = useRef(true),
    operation = useRef(0);
  useEffect(() => subscribeAccounts(setState), []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current++;
    };
  }, []);
  useEffect(() => {
    if (!state.configured || mode === 'manage' || mode === 'reset') return;
    let alive = true;
    setGoogleReady(false);
    googleSession.current = undefined;
    // Google and Firebase must be ready BEFORE the user's tap.
    Promise.all([prepareGoogleSession(), import('firebase/auth')])
      .then(([slot, sdk]) => {
        if (!alive) return;
        googleSession.current = { slot, sdk };
        setGoogleReady(true);
      })
      .catch((error) => {
        if (alive) setError(authMessage(error));
      });
    return () => {
      alive = false;
    };
  }, [state.configured, mode === 'manage' || mode === 'reset', googleAttempt]);
  function changeMode(next: typeof mode) {
    operation.current++;
    pending.current = undefined;
    setBusy(false);
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
  }
  async function submit(google = false) {
    const ticket = ++operation.current;
    const current = () => mounted.current && operation.current === ticket;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const prepared = googleSession.current;
      if (google && !prepared)
        throw Error('Google is still preparing. Please try again in a moment.');
      const slot = google
          ? prepared!.slot
          : (pending.current ??= await authDeadline(newAccountSession(), 20000)),
        sdk = google ? prepared!.sdk : await import('firebase/auth');
      if (!current()) return;
      let abandoned = false;
      async function signIn<T>(job: Promise<T>, milliseconds = 30000) {
        const tracked = job.then((result) => {
          if (abandoned || !current()) {
            sdk.signOut(slot.auth).catch(() => {});
            throw Error('The sign-in request was cancelled.');
          }
          return result;
        });
        try {
          return await authDeadline(tracked, milliseconds);
        } catch (error) {
          abandoned = true;
          pending.current = undefined;
          throw error;
        }
      }
      if (mode === 'reset' && !google) {
        try {
          await authDeadline(sdk.sendPasswordResetEmail(slot.auth, email));
        } catch (e) {
          if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
        }
        if (current())
          setMessage(
            'If this address has an account, a reset email will arrive. Check your spam folder too.',
          );
        return;
      }
      if (google) {
        setGoogleProgress('Waiting for Google…');
        const token = await prepared!.slot.request();
        if (!current()) return;
        setGoogleProgress('Signing you in…');
        await signIn(
          sdk.signInWithCredential(slot.auth, sdk.GoogleAuthProvider.credential(null, token)),
        );
      } else if (mode === 'signup') {
        const result = await signIn(sdk.createUserWithEmailAndPassword(slot.auth, email, password));
        if (name.trim()) {
          try {
            await authDeadline(sdk.updateProfile(result.user, { displayName: name.trim() }));
          } catch {
            setMessage('Your account is created. The profile name could not be saved yet.');
          }
        }
        try {
          await authDeadline(sdk.sendEmailVerification(result.user));
          setMessage('Account created. Check your email to verify your address.');
        } catch {
          setMessage(
            'Account created. The verification email could not be sent; you can retry below.',
          );
        }
      } else await signIn(sdk.signInWithEmailAndPassword(slot.auth, email, password));
      if (!current()) {
        await sdk.signOut(slot.auth);
        return;
      }
      await activateAccount(slot.id);
      pending.current = undefined;
      setPassword('');
      setMode('manage');
      if (google || mode === 'signin')
        setMessage('Signed in. This account’s document workspace is ready.');
    } catch (e) {
      if (current()) setError(authMessage(e));
    } finally {
      if (current()) {
        setBusy(false);
        setGoogleProgress('');
        if (google) {
          googleSession.current = undefined;
          setGoogleReady(false);
          setGoogleAttempt((n) => n + 1);
        }
      }
    }
  }
  const active = state.active;
  return (
    <div className="modal-shade account-shade">
      <section
        className="info-dialog account-dialog account-hub"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <button className="icon-button dialog-close" aria-label="Close account" onClick={onClose}>
          <X />
        </button>
        <div className="account-hub-brand">
          <Brand />
          <span>YOUR OWN LITTLE CORNER</span>
        </div>
        <h2 id="account-title">
          {mode === 'manage'
            ? 'One place. Your different worlds.'
            : mode === 'signup'
              ? 'Make room for your work.'
              : mode === 'reset'
                ? 'Let’s get you back in.'
                : `Welcome to ${brand.name}.`}
        </h2>
        <p className="account-intro">
          {mode === 'manage'
            ? 'Switch accounts to open their separate document libraries.'
            : 'Free tools, a personal document workspace, and no feature paywalls.'}
        </p>
        {!state.ready ? (
          <LoadingProgress
            label="Restoring your accounts…"
            detail="Your local document tools remain available."
          />
        ) : (
          <>
            {(mode === 'manage' || !state.configured) && (
              <div className="account-session-list">
                <button
                  className={`account-session ${!active ? 'current' : ''}`}
                  onClick={() => {
                    switchAccount(null);
                    onClose();
                  }}
                >
                  <span className="session-avatar guest">
                    <FolderOpen size={21} />
                  </span>
                  <span>
                    <strong>Guest workspace</strong>
                    <small>On this browser · no sign-in needed</small>
                  </span>
                  {!active ? <CheckCircle2 size={19} /> : <ArrowRight size={17} />}
                </button>
                {state.accounts.map((a) => (
                  <div
                    className={`account-session-wrap ${active?.id === a.id ? 'current' : ''}`}
                    key={a.id}
                  >
                    <button
                      className="account-session"
                      disabled={busy}
                      onClick={() => {
                        switchAccount(a.id);
                        onClose();
                      }}
                    >
                      <span className="session-avatar">{a.name.charAt(0).toUpperCase()}</span>
                      <span>
                        <strong>{a.name}</strong>
                        <small>{a.email}</small>
                        <small>
                          {a.verified ? 'Verified account' : 'Email verification pending'}
                        </small>
                      </span>
                      {active?.id === a.id && <CheckCircle2 size={19} />}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Sign out ${a.email}`}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          await disconnectCloud(workspaceId(a.uid));
                          await signOutAccount(a.id);
                          setMessage('Signed out. Downloaded copies and local files are kept.');
                        } catch (e) {
                          setError(authMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <LogOut size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!state.configured ? (
              <div className="account-service-note">
                <ShieldCheck size={20} />
                <div>
                  <strong>Online sign-in needs owner setup.</strong>
                  <p>
                    This deployment isn’t connected to its authentication project yet. Your guest
                    workspace and document tools are available.
                  </p>
                </div>
              </div>
            ) : mode === 'manage' ? (
              <>
                <button
                  className="button primary full"
                  disabled={busy}
                  onClick={() => changeMode('signin')}
                >
                  <Plus size={17} />
                  Add another account
                </button>
                {active && !active.verified && (
                  <div className="verification-actions">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const auth = await authClient(active.id);
                          if (auth.currentUser)
                            await (
                              await import('firebase/auth')
                            ).sendEmailVerification(auth.currentUser);
                          setMessage('Verification email sent.');
                        } catch (e) {
                          setError(authMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Mail size={14} />
                      Resend verification email
                    </button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const auth = await authClient(active.id);
                          if (auth.currentUser)
                            await (await import('firebase/auth')).reload(auth.currentUser);
                          await activateAccount(active.id);
                          setMessage(
                            auth.currentUser?.emailVerified
                              ? 'Email verified.'
                              : 'Verification is still pending.',
                          );
                        } catch (e) {
                          setError(authMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      I’ve verified my email
                    </button>
                  </div>
                )}
                <p className="account-fineprint">
                  Libraries and annotation drafts stay separate by account on this browser. Accounts
                  do not automatically sync files between devices. Use a cloud connection or export
                  for that.
                </p>
              </>
            ) : (
              <>
                {state.accounts.length > 0 && (
                  <button
                    className="text-button account-back"
                    disabled={busy}
                    onClick={() => changeMode('manage')}
                  >
                    <ArrowLeft size={14} />
                    Back to accounts
                  </button>
                )}
                {mode !== 'reset' && (
                  <>
                    <button
                      className="button secondary full google-signin"
                      disabled={busy || !googleReady}
                      onClick={() => submit(true)}
                    >
                      <span className="google-g" aria-hidden="true"><img src="/logos/google-g.png" width="20" height="20" alt=""/></span>
                      {busy
                        ? googleProgress || 'Connecting securely…'
                        : !googleReady
                          ? 'Preparing Google…'
                          : 'Continue with Google'}
                    </button>
                    {!googleReady && error && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setError('');
                          setGoogleAttempt((n) => n + 1);
                        }}
                      >
                        Retry Google sign-in
                      </button>
                    )}
                    <div className="account-divider">
                      <span>or use email</span>
                    </div>
                  </>
                )}
                <form
                  className="account-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  {mode === 'signup' && (
                    <label>
                      Your name
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        maxLength={80}
                      />
                    </label>
                  )}
                  <label>
                    Email
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </label>
                  {mode !== 'reset' && (
                    <label>
                      Password
                      <input
                        type="password"
                        required
                        minLength={mode === 'signup' ? 10 : 1}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      />
                      {mode === 'signup' && (
                        <small>
                          At least 10 characters. Your password goes directly to Firebase
                          Authentication.
                        </small>
                      )}
                    </label>
                  )}
                  <button className="button primary full" disabled={busy}>
                    {busy ? (
                      <span className="spinner" />
                    ) : mode === 'signup' ? (
                      'Create free account'
                    ) : mode === 'reset' ? (
                      'Send reset email'
                    ) : (
                      'Sign in'
                    )}
                    <ArrowRight size={16} />
                  </button>
                </form>
                <div className="account-switch">
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => changeMode(mode === 'signup' ? 'signin' : 'signup')}
                  >
                    {mode === 'signup'
                      ? 'Already have an account? Sign in'
                      : 'New here? Create an account'}
                  </button>
                  {mode === 'signin' && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => changeMode('reset')}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <p className="account-fineprint">
                  You can keep up to 10 accounts signed in in this tab. Sessions end when this
                  browser session is cleared. Every tool also works in your guest workspace.
                  <br />
                  {brand.name} {brand.version}
                </p>
              </>
            )}
          </>
        )}
        {(error || state.error) && (
          <p className="error-message" role="alert">
            {error || state.error}
          </p>
        )}
        {message && (
          <p className="account-message" role="status">
            <Check size={15} />
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
