import { useEffect, useRef } from 'react';
import { ArrowRight, Hand, Move, PenLine, X } from 'lucide-react';
export default function PenGuide({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLButtonElement>('button[data-start]')?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key === 'Tab') {
        const buttons = [...(box.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.shiftKey && at <= 0) {
          event.preventDefault();
          buttons.at(-1)?.focus();
        } else if (!event.shiftKey && at === buttons.length - 1) {
          event.preventDefault();
          buttons[0]?.focus();
        }
      }
    }
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      previous?.focus();
    };
  }, []);
  return (
    <div className="pen-guide-shade">
      <section
        ref={box}
        className="pen-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pen-guide-title"
      >
        <button className="icon-button dialog-close" aria-label="Close pen guide" onClick={onClose}>
          <X />
        </button>
        <span className="eyebrow">A QUICK HELLO TO YOUR WORKSPACE</span>
        <h2 id="pen-guide-title">Your pen. Your space.</h2>
        <p>Write, move, and zoom with a few simple gestures.</p>
        <div className="pen-guide-tip">
          <PenLine />
          <div>
            <strong>Your pen does the writing.</strong>
            <span>
              Choose Pen, then write with your stylus or mouse. Pressure and tilt work where your
              device supports them.
            </span>
          </div>
        </div>
        <div className="pen-guide-tip">
          <Move />
          <div>
            <strong>Two fingers, one smooth move.</strong>
            <span>
              Drag to move the page. Spread or pinch to zoom. You can move and zoom together.
            </span>
          </div>
        </div>
        <div className="pen-guide-tip">
          <Hand />
          <div>
            <strong>Let your hand settle.</strong>
            <span>
              Keep “Draw with finger” off for stylus writing. Single-finger contacts won’t move the
              page. Select text uses normal browser selection.
            </span>
          </div>
        </div>
        <button className="button primary" data-start onClick={onClose}>
          Let’s write <ArrowRight size={18} />
        </button>
        <small>Find this guide again with the ? button in the toolbar.</small>
      </section>
    </div>
  );
}
