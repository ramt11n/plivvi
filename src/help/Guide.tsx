import { useEffect, useState, useRef } from 'react';
import { CircleHelp, ChevronLeft, ChevronRight, X, Bug } from 'lucide-react';
import { guideControls } from './controlGuide';
export default function Guide() {
  const [open, setOpen] = useState(false),
    [intro, setIntro] = useState(false),
    [steps, setSteps] = useState<ReturnType<typeof guideControls>>([]),
    [index, setIndex] = useState(0),
    [rect, setRect] = useState<DOMRect>(),
    panel = useRef<HTMLElement>(null),
    previous = useRef<HTMLElement | null>(null),
    originalScroll = useRef({ x: 0, y: 0 }),
    scrollPositions = useRef<{ element: HTMLElement; top: number; left: number }[]>([]);
  useEffect(() => {
    try {
      setIntro(!localStorage.getItem('plivvi-guide-intro-v1'));
    } catch {
      setIntro(true);
    }
  }, []);
  function dismissIntro() {
    setIntro(false);
    try {
      localStorage.setItem('plivvi-guide-intro-v1', 'seen');
    } catch {}
  }
  useEffect(() => {
    window.addEventListener('plivvi:guide', begin);
    return () => window.removeEventListener('plivvi:guide', begin);
  }, []);
  function begin() {
    dismissIntro();
    previous.current = document.activeElement as HTMLElement;
    originalScroll.current = { x: window.scrollX, y: window.scrollY };
    const controls = guideControls();
    const ancestors = new Set<HTMLElement>();
    for (const step of controls) {
      for (let parent = step.element.parentElement; parent; parent = parent.parentElement) {
        if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth)
          ancestors.add(parent);
      }
    }
    scrollPositions.current = [...ancestors].map((element) => ({
      element,
      top: element.scrollTop,
      left: element.scrollLeft,
    }));
    setSteps(controls);
    setIndex(0);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    for (const { element, top, left } of scrollPositions.current)
      element.scrollTo({ top, left, behavior: 'instant' });
    window.scrollTo({
      left: originalScroll.current.x,
      top: originalScroll.current.y,
      behavior: 'instant',
    });
    previous.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!open) return;
    const target = steps[index]?.element;
    if (!target) {
      setRect(undefined);
      return;
    }
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const measure = () => setRect(target.getBoundingClientRect());
    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    panel.current
      ?.querySelector<HTMLButtonElement>('[data-guide-close]')
      ?.focus({ preventScroll: true });
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
      if (e.key === 'Tab') {
        const items = [...panel.current!.querySelectorAll<HTMLElement>('button,select')];
        const at = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && at <= 0) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && at === items.length - 1) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    }
    document.addEventListener('keydown', key, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [open, index, steps]);
  const step = steps[index],
    high = rect && rect.top > innerHeight / 2;
  return (
    <div data-guide-ignore>
      {!open && (
        <button className="guide-fab" aria-label="Guide to this page" onClick={begin}>
          <CircleHelp size={19} />
          <span>Guide</span>
        </button>
      )}
      {intro && !open && (
        <aside className="guide-intro" role="status">
          <button
            className="icon-button"
            aria-label="Dismiss guide introduction"
            onClick={dismissIntro}
          >
            <X size={16} />
          </button>
          <strong>A little help, wherever you are.</strong>
          <p>The Guide explains the buttons on your current page, one at a time.</p>
          <button className="text-button" onClick={begin}>
            Show me around <ChevronRight size={15} />
          </button>
        </aside>
      )}
      {open && (
        <div
          className="guide-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Guide to this page"
        >
          {rect && (
            <div
              className="guide-spotlight"
              style={{
                left: Math.max(3, rect.left - 5),
                top: Math.max(3, rect.top - 5),
                width: Math.min(innerWidth - 6, rect.width + 10),
                height: rect.height + 10,
              }}
            />
          )}
          <section ref={panel} className={`guide-card ${high ? 'guide-card-high' : ''}`}>
            <button
              data-guide-close
              className="icon-button dialog-close"
              aria-label="Close page guide"
              onClick={close}
            >
              <X />
            </button>
            <span className="eyebrow">YOUR WORKSPACE, EXPLAINED</span>
            <p className="guide-count">
              {steps.length ? index + 1 : 0} / {steps.length} controls
            </p>
            <h2>{step?.name ?? 'A fresh place to start'}</h2>
            <p>{step?.description ?? 'Open a tool or document to explore its controls.'}</p>
            <label>
              Jump to a control
              <select
                aria-label="Choose a control to explain"
                value={index}
                onChange={(e) => setIndex(+e.target.value)}
              >
                {steps.map((s, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="guide-actions">
              <button
                className="button secondary"
                disabled={!index}
                onClick={() => setIndex((i) => i - 1)}
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                className="button primary"
                onClick={() => (index < steps.length - 1 ? setIndex((i) => i + 1) : close())}
              >
                {index < steps.length - 1 ? 'Next' : 'Done'}
                <ChevronRight size={16} />
              </button>
            </div>
            <button
              className="text-button guide-report"
              onClick={() => {
                close();
                window.dispatchEvent(new Event('plivvi:report'));
              }}
            >
              <Bug size={15} />
              Something feels wrong? Report a bug
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
