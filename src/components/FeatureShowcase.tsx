import { useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Highlighter,
  Layers3,
  MousePointer2,
  PenLine,
  ScanLine,
  Type,
} from 'lucide-react';

const slides = [
  {
    key: 'ink',
    label: 'Your handwriting',
    eyebrow: 'PDF READER + DIGITAL INK',
    title: (
      <>
        Think it.
        <br />
        <em>Ink it.</em>
      </>
    ),
    description:
      'Write with Apple Pencil or a digital pen. Highlight a line, leave a note, or type right onto the page.',
    features: [
      'Pressure-aware pen strokes',
      'Selectable text + highlights',
      'Editable annotations',
    ],
    action: 'Open the PDF reader',
    tool: 'reader',
  },
  {
    key: 'scan',
    label: 'Paper to pixels',
    eyebrow: 'SCAN + ENHANCE',
    title: (
      <>
        A fresh start
        <br />
        <em>for every scan.</em>
      </>
    ),
    description:
      'Straighten the page, lift uneven shadows, and choose a cleaner look. Start with your camera or an existing photo.',
    features: ['Perspective correction', 'Shadow reduction + filters', 'Camera or photo import'],
    action: 'Clean up a scan',
    tool: 'scan',
  },
  {
    key: 'flow',
    label: 'Get it together',
    eyebrow: 'ORGANIZE + CONVERT',
    title: (
      <>
        A little order.
        <br />
        <em>A lot less effort.</em>
      </>
    ),
    description:
      'Bring files together, pull pages apart, or make a new format. Keep the useful bits and get on with your day.',
    features: [
      'Merge, split + reorder',
      'PDF, images + Office exports',
      'Download or save a new copy',
    ],
    action: 'Arrange your pages',
    tool: 'organize',
  },
];
export default function FeatureShowcase({
  onAction,
  onNotebook,
  compact = false,
}: {
  onAction: (tool: string) => void;
  onNotebook?: () => void;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0),
    start = useRef<{ x: number; y: number } | undefined>(undefined),
    item = slides[index];
  const change = (next: number) => setIndex((next + slides.length) % slides.length);
  return (
    <section
      className={`feature-showcase ${item.key} ${compact ? 'compact' : ''}`}
      aria-label="Discover document features"
      aria-roledescription="carousel"
    >
      <div className="feature-tabs" role="tablist" aria-label="Featured workflows">
        {slides.map((slide, i) => (
          <button
            key={slide.key}
            id={`feature-tab-${compact ? 'tools' : 'home'}-${i}`}
            role="tab"
            aria-selected={index === i}
            aria-controls={`feature-panel-${compact ? 'tools' : 'home'}`}
            tabIndex={index === i ? 0 : -1}
            onClick={() => change(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const next =
                  (i + (e.key === 'ArrowRight' ? 1 : -1) + slides.length) % slides.length;
                change(next);
                (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
              }
            }}
          >
            {i === 0 ? (
              <PenLine size={15} />
            ) : i === 1 ? (
              <ScanLine size={15} />
            ) : (
              <Layers3 size={15} />
            )}
            <span>{slide.label}</span>
          </button>
        ))}
      </div>
      <div
        className="feature-panel"
        id={`feature-panel-${compact ? 'tools' : 'home'}`}
        role="tabpanel"
        aria-labelledby={`feature-tab-${compact ? 'tools' : 'home'}-${index}`}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (start.current) {
            const dx = e.clientX - start.current.x,
              dy = e.clientY - start.current.y;
            if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5)
              change(index + (dx < 0 ? 1 : -1));
            start.current = undefined;
          }
        }}
        onPointerCancel={() => {
          start.current = undefined;
        }}
      >
        <div className="feature-copy" key={item.key}>
          <span className="feature-eyebrow">{item.eyebrow}</span>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          <ul>
            {item.features.map((f) => (
              <li key={f}>
                <Check size={13} />
                {f}
              </li>
            ))}
          </ul>
          <button className="feature-cta" onClick={() => onAction(item.tool)}>
            {item.action}
            <ArrowRight size={17} />
          </button>
          {item.key === 'ink' && (
            <button className="feature-notebook-link" onClick={onNotebook}>
              Start a free notebook <ArrowRight size={14} />
            </button>
          )}
          {item.key === 'ink' && (
            <small className="feature-device-note">
              Apple Pencil requires a compatible iPad. Finger drawing is available too.
            </small>
          )}
        </div>
        <div className={`feature-art ${item.key}`} aria-hidden="true">
          {item.key === 'ink' ? (
            <>
              <div className="ink-orbit" />
              <div className="feature-tablet">
                <div className="tablet-camera" />
                <div className="tablet-screen">
                  <div className="tablet-toolbar">
                    <span>
                      <FileText size={11} />
                      Field notes.pdf
                    </span>
                    <PenLine size={13} />
                    <Highlighter size={13} />
                    <Type size={13} />
                    <MousePointer2 size={13} />
                  </div>
                  <div className="tablet-page">
                    <span className="note-date">MONDAY / A FRESH PAGE</span>
                    <strong>
                      Make room
                      <br />
                      for a good idea.
                    </strong>
                    <p>
                      Read a little. Mark what matters.
                      <br />
                      Leave your thoughts in the margins.
                    </p>
                    <span className="note-highlight" />
                    <svg className="note-ink" viewBox="0 0 240 95">
                      <path
                        d="M18 68C48 9 52 14 46 51S81 13 75 54s38-46 37-6c0 20 16 11 30-6s-2 37 26 9 25-4 43 4M18 85q100-17 190-7"
                        fill="none"
                        stroke="#3659e3"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="note-margin">worth remembering ↗</span>
                  </div>
                </div>
              </div>
              <img
                className="feature-stylus"
                src="/visuals/stylus.png"
                width="1280"
                height="1280"
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span className="ink-caption">
                <span />
                Your handwriting. On your PDF.
              </span>
            </>
          ) : item.key === 'scan' ? (
            <>
              <div className="scan-orbit" />
              <div className="scan-photo">
                <div className="scan-photo-paper">
                  <span>FIELD NOTES</span>
                  <strong>
                    A cleaner
                    <br />
                    point of view.
                  </strong>
                  <i />
                  <i />
                  <i />
                  <i />
                  <div className="scan-paper-stamp">
                    <Check size={24} />
                  </div>
                </div>
                <span className="scan-corner top-left" />
                <span className="scan-corner top-right" />
                <span className="scan-corner bottom-left" />
                <span className="scan-corner bottom-right" />
                <span className="scan-beam" />
              </div>
              <span className="scan-art-chip">
                <ScanLine size={16} />
                Find the edges. Keep the page.
              </span>
            </>
          ) : (
            <>
              <div className="flow-orbit" />
              <div className="flow-file file-left">
                <span>01</span>
                <FileText size={33} />
                <strong>Notes.pdf</strong>
                <i />
                <i />
              </div>
              <div className="flow-file file-middle">
                <span>02</span>
                <FileText size={33} />
                <strong>Ideas.pdf</strong>
                <i />
                <i />
              </div>
              <div className="flow-file file-right">
                <span>03</span>
                <FileText size={33} />
                <strong>Plans.pdf</strong>
                <i />
                <i />
              </div>
              <div className="flow-complete">
                <Check size={18} />
                <span>
                  Everything, in order.<small>One tidy document.</small>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="feature-pagination">
        <span>
          <b>{String(index + 1).padStart(2, '0')}</b> / {String(slides.length).padStart(2, '0')}
        </span>
        <div>
          <button aria-label="Previous feature" onClick={() => change(index - 1)}>
            <ChevronLeft size={17} />
          </button>
          <button aria-label="Next feature" onClick={() => change(index + 1)}>
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
