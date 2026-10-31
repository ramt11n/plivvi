import { useEffect, useState } from 'react';
import { ArrowRight, Check, LogOut, Mail, ShieldCheck, UserRound, X } from 'lucide-react';
import { account, authClient, authMessage, type Account } from '../integrations/auth';
import { integrationConfig, maker } from '../integrations/config';
export default function AccountDialog({
  onClose,
  onAccount,
}: {
  onClose: () => void;
  onAccount: (account: Account | null) => void;
}) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin'),
    [configured, setConfigured] = useState<boolean | null>(null),
    [user, setUser] = useState<Account | null>(null),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true,
      unsubscribe: () => void = () => {};
    integrationConfig()
      .then(async (c) => {
        const ready = !!(
          c.firebase?.apiKey &&
          c.firebase.authDomain &&
          c.firebase.appId &&
          c.firebase.projectId
        );
        if (alive) setConfigured(ready);
        if (!ready) return;
        const auth = await authClient(),
          { onAuthStateChanged } = await import('firebase/auth');
        if (!alive) return;
        unsubscribe = onAuthStateChanged(auth, (u) => {
          const next = u ? account(u) : null;
          setUser(next);
          onAccount(next);
        });
      })
      .catch((e) => {
        if (alive) {
          setConfigured(false);
          setError(authMessage(e));
        }
      });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  async function submit(google = false) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const auth = await authClient(),
        sdk = await import('firebase/auth');
      if (google) {
        const result = await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
        setUser(account(result.user));
        onAccount(account(result.user));
        setMessage('Signed in. Your PDFs remain on this device.');
      } else if (mode === 'reset') {
        await sdk.sendPasswordResetEmail(auth, email);
        setMessage(
          'If this address has an account, a password reset email will arrive. Check your spam folder too.',
        );
      } else if (mode === 'signup') {
        const result = await sdk.createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await sdk.updateProfile(result.user, { displayName: name.trim() });
        await sdk.sendEmailVerification(result.user);
        setUser(account(result.user));
        onAccount(account(result.user));
        setMessage('Your account is ready. Check your email to verify your address.');
      } else {
        const result = await sdk.signInWithEmailAndPassword(auth, email, password);
        setUser(account(result.user));
        onAccount(account(result.user));
        setMessage('Welcome back. Your local workspace is ready.');
      }
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-shade account-shade">
      <section
        className="info-dialog account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <button className="icon-button dialog-close" aria-label="Close account" onClick={onClose}>
          <X />
        </button>
        <span className="tool-icon violet">
          <UserRound />
        </span>
        <span className="eyebrow">ALWAYS OPTIONAL. ALWAYS FREE.</span>
        <h2 id="account-title">
          {user
            ? 'Make yourself at home.'
            : mode === 'signup'
              ? 'A small account. No paywalls.'
              : mode === 'reset'
                ? 'Let’s get you back in.'
                : 'Welcome to your pocket.'}
        </h2>
        {configured === null ? (
          <p className="processing-line">
            <span className="spinner" />
            Checking sign-in…
          </p>
        ) : !configured ? (
          <>
            <p>
              Accounts are being prepared on this deployment. You can already use every PDF tool
              without signing in.
            </p>
            <div className="account-guest-note">
              <ShieldCheck size={21} />
              <span>Your files stay in your browser. There is no account-based feature limit.</span>
            </div>
            <button className="button primary full" onClick={onClose}>
              Continue as a guest <ArrowRight size={16} />
            </button>
            <a
              className="text-button"
              href={`mailto:${maker.email}?subject=Pocket%20account%20availability`}
            >
              Ask Ramtin about accounts <Mail size={14} />
            </a>
          </>
        ) : user ? (
          <>
            <div className="account-profile">
              <div>{user.name.charAt(0).toUpperCase()}</div>
              <span>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
                <small>{user.verified ? 'Email verified' : 'Email not verified yet'}</small>
              </span>
            </div>
            <p>
              Signed in for your profile. Document processing and this workspace stay on the current
              device. Cloud storage is a separate connection.
            </p>
            {!user.verified && (
              <button
                className="button secondary full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const auth = await authClient();
                    if (auth.currentUser) {
                      await (await import('firebase/auth')).sendEmailVerification(auth.currentUser);
                      setMessage('Verification email sent.');
                    }
                  } catch (e) {
                    setError(authMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send verification email
              </button>
            )}
            <button
              className="button secondary full"
              disabled={busy}
              onClick={async () => {
                try {
                  await (await import('firebase/auth')).signOut(await authClient());
                  setUser(null);
                  onAccount(null);
                } catch (e) {
                  setError(authMessage(e));
                }
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </>
        ) : (
          <>
            {mode !== 'reset' && (
              <>
                <button
                  className="button secondary full google-signin"
                  disabled={busy}
                  onClick={() => submit(true)}
                >
                  <span className="google-g" aria-hidden="true">
                    G
                  </span>
                  Continue with Google
                </button>
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
                      Use at least 10 characters. Your password goes directly to the authentication
                      provider.
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
                onClick={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                  setError('');
                  setMessage('');
                }}
              >
                {mode === 'signup'
                  ? 'Already have an account? Sign in'
                  : 'New here? Create an account'}
              </button>
              {mode === 'signin' && (
                <button className="text-button" onClick={() => setMode('reset')}>
                  Forgot password?
                </button>
              )}
            </div>
            <p className="account-fineprint">
              All tools also work as a guest. Signing in does not upload or sync your documents.
            </p>
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
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
