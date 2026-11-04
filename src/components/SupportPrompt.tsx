import { useEffect, useState } from 'react';
import { Heart, ArrowUpRight, X } from 'lucide-react';
const cooldown = 7 * 86400000;
export default function SupportPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function exported() {
      try {
        if (
          sessionStorage.getItem('plivvi-support-prompt') ||
          Date.now() - Number(localStorage.getItem('plivvi-support-dismiss') || 0) < cooldown
        )
          return;
        sessionStorage.setItem('plivvi-support-prompt', 'shown');
      } catch {}
      clearTimeout(timer);
      timer = setTimeout(() => setShow(true), 700);
    }
    window.addEventListener('plivvi:export', exported);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('plivvi:export', exported);
    };
  }, []);
  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem('plivvi-support-dismiss', String(Date.now()));
    } catch {}
  }
  if (!show) return null;
  return (
    <aside data-guide-ignore className="support-prompt" role="status">
      <button className="icon-button" aria-label="Dismiss support invitation" onClick={dismiss}>
        <X size={17} />
      </button>
      <span className="support-prompt-heart">
        <Heart size={20} />
      </span>
      <strong>Your export started. Help build what’s next?</strong>
      <p>
        A little support helps improve Plivvi, fix bugs, and test more devices. Every tool stays
        free.
      </p>
      <a
        className="button primary"
        href="/support/"
        target="_blank"
        rel="noreferrer"
        onClick={dismiss}
      >
        Support improvements <ArrowUpRight size={15} />
      </a>
      <button className="text-button" onClick={dismiss}>
        Maybe another time
      </button>
    </aside>
  );
}
