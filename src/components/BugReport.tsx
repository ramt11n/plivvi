import { useEffect, useState, useRef } from 'react';
import { Bug, X, ArrowUpRight, Mail } from 'lucide-react';
import brand from '../brand.json';
const privateReportUrl =
  'https://docs.google.com/forms/d/e/1FAIpQLScsfFwe9VUvvYfZLnxJr1eOyJDTSWBDp69Fc4PWjuoW5EErRw/viewform';
export default function BugReport() {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<'choose' | 'private' | 'github'>('choose'),
    [formLoaded, setFormLoaded] = useState(false),
    [title, setTitle] = useState(''),
    [message, setMessage] = useState(''),
    [details, setDetails] = useState(true),
    [error, setError] = useState(''),
    box = useRef<HTMLElement>(null);
  useEffect(() => {
    const show = () => {
      setMode('choose');
      setFormLoaded(false);
      setOpen(true);
    };
    window.addEventListener('plivvi:report', show);
    return () => window.removeEventListener('plivvi:report', show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const old = document.activeElement as HTMLElement;
    box.current?.querySelector<HTMLElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const controls = Array.from(
          box.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input,textarea,iframe',
          ) ?? [],
        ).filter((el) => el.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      old?.focus();
    };
  }, [open]);
  const body = () =>
    `What happened?\n${message}\n\nPlivvi ${brand.version}\nPage: ${location.origin + location.pathname}${details ? '\nBrowser: ' + navigator.userAgent : ''}\n\nExpected behavior / steps to reproduce:\n`;
  if (!open) return null;
  return (
    <div className="modal-shade bug-report-shade">
      <section
        ref={box}
        className="info-dialog bug-report"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close bug report"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <span className="tool-icon mint">
          <Bug />
        </span>
        <h2 id="bug-report-title">Help make Plivvi better.</h2>
        <p>Tell Ramtin what got in your way. No document is attached.</p>
        <div className="report-choices">
          {mode !== 'private' && (
            <button className="button primary" onClick={() => setMode('private')}>
              Open private report form
            </button>
          )}
          {mode !== 'github' && (
            <button className="button secondary" onClick={() => setMode('github')}>
              Report publicly on GitHub
            </button>
          )}
          <a className="text-button" href="mailto:plivvi.pages@gmail.com?subject=Plivvi%20feedback">
            Email Plivvi
          </a>
        </div>
        {mode === 'choose' && (
          <p className="report-privacy">
            The private form uses Google Forms and loads only when you choose it. Your message goes
            to the project owner; an email address is optional. Leave out passwords and private
            document contents.
          </p>
        )}
        {mode === 'private' && (
          <>
            <p className="small muted">
              Private to the project owner · hosted by Google Forms · no document attached. Submit
              inside the form to send your report.
            </p>
            {!formLoaded && (
              <p role="status" className="report-frame-loading">
                Opening the private report form…
              </p>
            )}
            <iframe
              title="Private Plivvi bug report form"
              src={privateReportUrl + '?embedded=true'}
              onLoad={() => setFormLoaded(true)}
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <a className="text-button" href={privateReportUrl} target="_blank" rel="noreferrer">
              Form not loading? Open it in a new tab <ArrowUpRight size={15} />
            </a>
          </>
        )}
        {mode === 'github' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !message.trim()) {
                setError('Add a short title and what happened.');
                return;
              }
              window.open(
                'https://github.com/ramt11n/plivvi/issues/new?' +
                  new URLSearchParams({ title: 'Bug: ' + title, body: body() }),
                '_blank',
                'noopener,noreferrer',
              );
            }}
          >
            <label>
              Short title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={150}
                placeholder="For example: highlighter stops after a stroke"
              />
            </label>
            <label>
              What happened?
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={6000}
                rows={5}
                placeholder="Which tool, what you tried, and what you expected…"
              />
            </label>
            <label className="report-details">
              <input
                type="checkbox"
                checked={details}
                onChange={(e) => setDetails(e.target.checked)}
              />
              Include browser information
            </label>
            <p className="small muted">
              GitHub reports are public and reviewed there before posting. For a private report, use
              email. Leave out passwords and private document contents.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="guide-actions">
              <button className="button primary" type="submit">
                Review on GitHub <ArrowUpRight size={15} />
              </button>
              <a
                className="button secondary"
                href={
                  'mailto:plivvi.pages@gmail.com?' +
                  new URLSearchParams({ subject: 'Plivvi bug: ' + title, body: body() })
                }
              >
                <Mail size={15} />
                Email privately
              </a>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
